import { PayloadRequest, Where } from 'payload'
import type { Meeting } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

async function processMeeting(
  meeting: Meeting,
  req: PayloadRequest,
  funds: string[],
): Promise<void> {
  let isDirty = false
  console.log(`Handling meeting ${meeting.id} - ${meeting.holdingsLimit}`)

  // Get holdings for each company
  const holdings = await Promise.all(
    funds.map(async (fund) => {
      // Get the holdings matching the less than equal holdings date
      const { docs: holdingsDocs } = await req.payload.find({
        collection: 'holdings',
        depth: 0,
        where: {
          and: [
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
            { fund: { equals: fund } },
          ],
        },
        sort: '-valueDate',
        limit: 1,
      })

      const nearestHoldingsLimitDate = holdingsDocs.length > 0 ? holdingsDocs[0].valueDate : null
      if (!nearestHoldingsLimitDate) {
        return [] // No holdings found
      }

      // Get the holdings matching the nearest holdings date
      const { docs: holdingsLimitDateDocs } = await req.payload.find({
        collection: 'holdings',
        depth: 0,
        where: {
          and: [
            { stock: { equals: meeting.stock } },
            { valueDate: { equals: new Date(nearestHoldingsLimitDate) } },
            { fund: { equals: fund } },
          ],
        },
        limit: 0,
      })

      return holdingsLimitDateDocs
    }),
  )

  const flattenedHoldings = holdings.flat()

  // Check and update funds list
  const newFundsSet = new Set<string>()

  for (let i = 0; i < flattenedHoldings.length; i++) {
    const holding = flattenedHoldings[i]
    const fundId: string = getIdOfRelationField(holding.fund) as string
    if (!newFundsSet.has(fundId)) {
      newFundsSet.add(fundId)
      isDirty = true
    }
  }

  const newFunds = Array.from(newFundsSet)

  // Update meeting if necessary
  if (isDirty || !meeting.fundsWithHolding?.length) {
    req.payload.logger.info(
      `Successfully processed companies-meeting: ${meeting.id} with companies: ${newFunds.join(', ')}`,
    )

    const fundsWithHolding = flattenedHoldings.map((h) => ({
      company: String(getIdOfRelationField(h.fund)),
      holding: h.id,
    }))
    let stockValue = meeting.stockValue
    if (!stockValue) {
      const { docs: stockValueDocs } = await req.payload.find({
        collection: 'stock-values',
        depth: 0,
        where: {
          and: [
            { stockId: { equals: getIdOfRelationField(meeting.stock) } },
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
          ],
        },
        limit: 1,
        sort: '-valueDate',
      })
      stockValue = stockValueDocs[0].id
    }
    const companies = await req.payload.find({
      collection: 'companies',
      depth: 0,
      select:{
        parentCompany: true
      },
      where:{
        id:{
          in: newFunds
        }
      }
    })
    const compIds=companies.docs.map((comp)=>{
      if (comp?.parentCompany?.docs){
        return comp.parentCompany.docs[0]
      }
    })
    await req.payload.update({
      collection: 'meetings',
      id: meeting.id,
      req: {
        ...req,
        context: { ...req.context, from: 'process' },
      },
      data: {
        companies: Array.from(new Set(compIds)),
        funds: [...newFunds],
        fundsWithHolding,
        stockValue,
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
    req.payload.logger.info('Starting to load funds')
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
        type:{equals:'fund'}
      },
    })
    const funds = docs.length > 0 ? (docs.map(getIdOfRelationField) as string[]) : []

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
        const promise = processMeeting(meeting, req, funds)
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
    req.payload.logger.error(
      `Error processing companies-meetings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    )
    throw error
  }
}
