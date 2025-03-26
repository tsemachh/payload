import { PayloadRequest } from 'payload'
import type { Account, Meeting, Stock } from '@/payload-types'
import { getIdOfRelationField, getStockIds } from '@/utils/utils'

async function processMeeting(meeting: Meeting, req: PayloadRequest): Promise<void> {
  const stockIds: string[] = await getStockIds(meeting.stock as Stock)
  const companies = meeting?.companies?.map(getIdOfRelationField) as string[] || []
  let isDirty: boolean = false
  console.log(`Handling meeting ${meeting.id} - ${meeting.holdingsLimit}`)
  // Check if the company has holdings for this meeting's stock on the holdingsLimit date
  let { docs: holdings } = await req.payload.find({
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

  // If no holdings found for the holdingsLimit date, get the most recent holdings reported
  if (holdings.length === 0 && new Date(meeting.holdingsLimit as string) > new Date()) {
    req.payload.logger.info(`No holdings found for meeting ${meeting.id} on ${meeting.holdingsLimit}, getting most recent holdings`)
    const { docs: recentHoldings } = await req.payload.find({
      collection: 'holdings',
      where: {
        and: [
          { stock: { in: stockIds } },
          { valueDate: { less_than: meeting.holdingsLimit } },
          { quantity: { greater_than: 1 } },
        ],
      },
      limit: 1000,
      depth: 1,
      sort: '-valueDate', // Sort by valueDate in descending order to get the most recent
    })
    holdings = recentHoldings
  }
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
    await req.payload.update({
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
 // Get all meetings or specific meetings if meetingIds is provided
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

    // Process meetings in batches to avoid MongoDB session issues
    const batchSize = 10; // Process 10 meetings at a time

    // Process meetings in batches
    for (let i = 0; i < meetings.length; i += batchSize) {
      const batchPromises: Promise<void>[] = []
      const batchEnd = Math.min(i + batchSize, meetings.length)

      req.payload.logger.info(`Processing batch ${i/batchSize + 1} (meetings ${i+1}-${batchEnd} of ${meetings.length})`)

      // Create promises for this batch
      for (let j = i; j < batchEnd; j++) {
        const meeting = meetings[j]
        // Skip if meeting doesn't have a stock or holdingsLimit
        if (!meeting.stock || !meeting.holdingsLimit) {
          continue
        }
        const promise = processMeeting(meeting, req).then(() => {
          console.log('meeting finished', meeting.id)
        })
        batchPromises.push(promise)
      }

      // Wait for this batch to complete before moving to the next
      await Promise.all(batchPromises)
      req.payload.logger.info(`Completed batch ${i/batchSize + 1}`)
    }

    req.payload.logger.info('End of process: All meetings have been processed')
  }//@ts-ignore
  catch (error: Error) {
    req.payload.logger.error(`Error processing companies-meetings: ${error.message} `, error)
    throw error
  }
}
