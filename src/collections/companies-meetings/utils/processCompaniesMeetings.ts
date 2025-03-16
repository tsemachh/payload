import { PayloadRequest } from 'payload'
import type { Account, Meeting, Stock } from '@/payload-types'
import { getIdOfRelationField, getStockIds } from '@/utils/utils'

async function processMeeting(meeting: Meeting, req: PayloadRequest): Promise<void> {
  const stockIds: string[] = await getStockIds(meeting.stock as Stock)
  const companies = meeting?.companies?.map(getIdOfRelationField) as string[] || []
  let isDirty: boolean = false
  console.log(`Handling meeting ${meeting.id} - ${meeting.holdingsLimit}`)
  // Check if the company has holdings for this meeting's stock on the holdingsLimit date
  const { docs: holdings } = await req.payload.find({
    collection: 'holdings',
    where: {
      and: [
        { stock: { in: stockIds } },
        { valueDate: { equals: meeting.holdingsLimit } },
        { quantity: { greater_than: 0 } },
      ],
    },
    limit: 1000,
    depth: 1,
  })
  for (let i = 0; i < holdings.length; i++) {
    const holding = holdings[i]
    const account: Account = holding.account as Account
    const companyId: string = getIdOfRelationField(account.company) as string
    if (!companies.includes(companyId)) {// Avoid duplicate companyIds
      companies.push(companyId)
      isDirty = true
    }
  }
  if (isDirty) {
    req.payload.logger.info('Successfully processed companies-meeting:' + meeting.id + ' with companies:' + companies.toString())
    req.payload.update({
      collection: 'meetings',
      id: meeting.id,
      data: {
        companies,
      },
    })
  }
}

/**
 * Process companies and meetings to populate the companies-meetings collection
 * This function:
 * 1. Gets all leaf companies (companies with accounts)
 * 2. For each meeting, checks if a company has holdings for the meeting's stock on the holdingLimit date
 * 3. If a match is found, adds an entry to the companies-meetings collection
 *
 * @param req PayloadRequest object
 * @param meetingIds Optional array of meeting IDs to process. If not provided, all meetings will be processed.
 */
export const processCompaniesMeetings = async (
  req: PayloadRequest,
  meetingIds?: string[],
  ): Promise<void> => {
  try {
    req.payload.logger.info('Starting to load companies')
    let where = {}
  /*  if (companyIds) {
      where = { id: { in: companyIds } }
    }
    // Get all leaf companies (companies with accounts) or specific companies if companyIds is provided
    const { docs: allCompanies } = await req.payload.find({
      collection: 'companies',
      limit: 1000,
      where,
    })
    const leafCompanies = allCompanies.filter((theCompany) => {
      return (theCompany.accounts && theCompany.accounts?.docs && theCompany.accounts?.docs?.length > 0)
    })
    req.payload.logger.info('loaded companies:' + leafCompanies.length)
    // Create a map of company IDs to their account IDs
    const companyAccountsMap = new Map<string, string[]>()
  */  // Get all meetings or specific meetings if meetingIds is provided
    req.payload.logger.info('Starting to load meetings')
    if (meetingIds) {
      where = { id: { in: meetingIds } }
    } else {
      where = {}
    }
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      limit: 20000,
      where,
      depth: 1,
      sort: '-holdingsLimit',
    })
    req.payload.logger.info('loaded meetings:' + meetings.length)
/*
    for (const company of leafCompanies) {
      const accounts = company?.accounts?.docs
      if (accounts)// Store the account IDs for this company
        companyAccountsMap.set(company.id,
          accounts.map(getIdOfRelationField) as string[])
    }
*/

    // For each leaf company, get its account IDs
    const promises: Promise<void>[] = []
    for (const meeting of meetings) {
      // Skip if meeting doesn't have a stock or holdingsLimit
      if (!meeting.stock || !meeting.holdingsLimit) {
        continue
      }
      processMeeting(meeting, req).then(() => {
        console.log('meeting finiahed', meeting.id)
      })
    }

    // Wait for all meetings to be processed
    await Promise.all(promises)
    req.payload.logger.info('End of process: All meetings have been processed')
  }//@ts-ignore
  catch (error: Error) {
    req.payload.logger.error(`Error processing companies-meetings: ${error.message} `, error)
    throw error
  }
}
