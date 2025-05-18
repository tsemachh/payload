import { PayloadRequest, Where } from 'payload'
import type { Meeting } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

async function processMeeting(
  meeting: Meeting,
  req: PayloadRequest,
  companies: string[],
): Promise<void> {
  let isDirty = false
  console.log(`Handling meeting ${meeting.id} - ${meeting.holdingsLimit}`)

  // Get holdings for each company
  const holdings = await Promise.all(
    companies.map(async (company) => {
      // Get the holdings matching the less than equal holdings date
      const { docs: holdingsLimitDateDocs } = await req.payload.find({
        collection: 'holdings',
        depth: 0,
        where: {
          and: [
            { stock: { equals: meeting.stock } },
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
            { company: { equals: company } },
          ],
        },
        sort: '-valueDate',
        limit: 1,
      })
      return holdingsLimitDateDocs
    }),
  )

  const flattenedHoldings = holdings.flat()

  // Check and update companies list
  const newCompaniesSet = new Set<string>()

  for (let i = 0; i < flattenedHoldings.length; i++) {
    const holding = flattenedHoldings[i]
    const companyId: string = getIdOfRelationField(holding.company) as string
    if (!newCompaniesSet.has(companyId)) {
      newCompaniesSet.add(companyId)
      isDirty = true
    }
  }

  const newCompanies = Array.from(newCompaniesSet)

  // Update meeting if necessary
  if (isDirty) {
    req.payload.logger.info(
      `Successfully processed companies-meeting: ${meeting.id} with companies: ${newCompanies.join(', ')}`,
    )

    const now = new Date()
    const isHoldingsLimitInFuture = new Date(meeting.holdingsLimit as string) > now

    if (isHoldingsLimitInFuture) {
      await req.payload.update({
        collection: 'meetings',
        id: meeting.id,
        req: {
          ...req,
          context: { ...req.context, from: 'process' },
        },
        data: {
          companies: newCompanies,
        },
      })
    } else {
      const companiesWithHolding = flattenedHoldings.map((h) => ({
        company: String(getIdOfRelationField(h.company)),
        quantity: h,
      }))
      
      const { docs: stockValues } = await req.payload.find({
        collection: 'stock-values',
        depth: 1,
        where: {
          and: [
            { stockId: { equals: getIdOfRelationField(meeting.stock) } },
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
          ],
        },
        limit: 1,
        sort: '-valueDate',
      })

      await req.payload.update({
        collection: 'meetings',
        id: meeting.id,
        req: {
          ...req,
          context: { ...req.context, from: 'process' },
        },
        data: {
          companies: newCompanies,
          companiesWithHolding,
          stockValues: stockValues[0],
        },
      })
    }
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
    // Get all meetings or specific meetings if meetingIds is provided
    req.payload.logger.info('Starting to load meetings')
    const where = meetingIds ? { id: { in: meetingIds } } : ({} as Where)
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      limit: 20000,
      where,
      depth: 1,
      sort: '-holdingsLimit',
    })
    req.payload.logger.info('loaded meetings:' + meetings.length)

    const { docs } = await req.payload.find({
      collection: 'companies',
      depth: 0,
      limit: 0,
      where: {
        or: [{ subCompanies: { equals: [] } }, { subCompanies: { exists: false } }],
      },
    })
    const companies = docs.length > 0 ? (docs.map(getIdOfRelationField) as string[]) : []

    // Process meetings in batches to avoid MongoDB session issues
    const batchSize = 10 // Process 10 meetings at a time

    // Process meetings in batches
    for (let i = 0; i < meetings.length; i += batchSize) {
      const batchPromises: Promise<void>[] = []
      const batchEnd = Math.min(i + batchSize, meetings.length)

      req.payload.logger.info(
        `Processing batch ${i / batchSize + 1} (meetings ${i + 1}-${batchEnd} of ${meetings.length})`,
      )

      // Create promises for this batch
      for (let j = i; j < batchEnd; j++) {
        const meeting = meetings[j]
        // Skip if meeting doesn't have a stock or holdingsLimit
        if (!meeting.stock || !meeting.holdingsLimit) {
          continue
        }
        console.log('meeting started', meeting.id)
        const promise = processMeeting(meeting, req, companies)
          .then(() => {
            console.log('meeting finished', meeting.id)
          })
          .catch((error) => {
            req.payload.logger.error(
              `Error processing meeting ${meeting.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error,
            )
            // Don't rethrow the error to allow other meetings to be processed
          })
        batchPromises.push(promise)
      }

      // Wait for this batch to complete before moving to the next
      await Promise.all(batchPromises)
      req.payload.logger.info(`Completed batch ${i / batchSize + 1}`)
    }

    req.payload.logger.info('End of process: All meetings have been processed')
  } catch (error: unknown) {
    //@ts-ignore
    req.payload.logger.error(
      `Error processing companies-meetings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    )
    throw error
  }
}
