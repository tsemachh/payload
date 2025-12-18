import { PayloadRequest } from 'payload'
import { processCompaniesMeetings } from '@/collections/meetings/hooks/processCompaniesMeetings'
import type { Holding } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

/**
 * Update companies-meetings collection when a holding is created or updated
 * This function:
 * 1. Gets the company associated with the account in the holding
 * 2. Checks which stocks changed by comparing with previous holding
 * 3. Gets future meetings that are not completed and include those stocks
 * 4. Processes only the funds that changed for those meetings
 *
 * @param req PayloadRequest object
 * @param holding The holding that was created or updated
 */
export const updateCompaniesMeetingsOnHoldingChange = async (
  req: PayloadRequest,
  holding: Holding,
): Promise<void> => {
  try {
    const startTime = Date.now()
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        holdingId: holding.id,
        fundId: getIdOfRelationField(holding.fund),
        valueDate: holding.valueDate,
      },
      'Starting updateCompaniesMeetingsOnHoldingChange',
    )

    if (!holding.fund || !holding.valueDate) {
      return
    }

    const fundId = getIdOfRelationField(holding.fund) as string

    // Get previous holding for this fund to compare changes
    // Use less_than_equal to include same-day holdings, then filter out the current one
    const { docs: previousHoldings } = await req.payload.find({
      collection: 'holdings',
      where: {
        and: [
          { fund: { equals: fundId } },
          { valueDate: { less_than_equal: holding.valueDate } },
          { id: { not_equals: holding.id } }, // Exclude the current holding
        ],
      },
      sort: '-valueDate,-createdAt', // Sort by date DESC, then creation time DESC
      limit: 1,
      depth: 0,
    })

    // Identify changed stocks (added, removed, or quantity changed)
    const changedStockIds = new Set<string>()
    const currentHoldingMap = new Map(
      holding.holdings.map((h) => [getIdOfRelationField(h.stock) as string, h.quantity]),
    )

    // Compare with previous holding if exists
    if (previousHoldings.length > 0) {
      const previousHolding = previousHoldings[0]
      const isSameDayUpdate = previousHolding.valueDate === holding.valueDate

      req.payload.logger.info({
        previousHoldingId: previousHolding.id,
        previousValueDate: previousHolding.valueDate,
        currentValueDate: holding.valueDate,
        isSameDayUpdate,
      }, 'Comparing against previous holding')

      const previousHoldingMap = new Map(
        previousHolding.holdings.map((h: any) => [
          getIdOfRelationField(h.stock) as string,
          h.quantity,
        ]),
      )

      // Check for removed stocks
      previousHolding.holdings.forEach((h: any) => {
        const stockId = getIdOfRelationField(h.stock) as string
        if (stockId && !currentHoldingMap.has(stockId)) {
          changedStockIds.add(stockId)
        }
      })

      // Check for quantity changes (already added above, but filter out unchanged ones)
      holding.holdings.forEach((h) => {
        const stockId = getIdOfRelationField(h.stock) as string
        const currentQty = currentHoldingMap.get(stockId)
        const previousQty = previousHoldingMap.get(stockId)
        if (!(currentQty === previousQty)) {
          changedStockIds.add(stockId)
        }
      })
    } else {
      // No previous holding - all current stocks are new
      holding.holdings.forEach((h) => {
        const stockId = getIdOfRelationField(h.stock) as string
        if (stockId) changedStockIds.add(stockId)
      })
    }

    if (changedStockIds.size === 0) {
      req.payload.logger.info('No stock changes detected, skipping meeting updates')
      return
    }

    req.payload.logger.info(
      {
        changedStocks: Array.from(changedStockIds),
        changedStocksCount: changedStockIds.size,
      },
      'Detected stock changes',
    )

    // Get future meetings that are not completed and include the changed stocks
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      select: {},
      where: {
        and: [
          { stock: { in: Array.from(changedStockIds) } },
          { holdingsLimit: { greater_than_equal: holding.valueDate } },
          { finalized: { not_equals: true } },
        ],
      },
      limit: 0,
      depth: 0,
    })

    if (meetings.length === 0) {
      req.payload.logger.info('No future meetings found for changed stocks')
      return
    }

    req.payload.logger.info(
      {
        meetingsFound: meetings.length,
        meetingIds: meetings.map((m) => m.id),
      },
      'Found future meetings to update',
    )

    // Process companies-meetings for the specific fund and meetings
    await processCompaniesMeetings(
      req,
      meetings.map((meeting) => meeting.id),
      [fundId], // Only process the fund that changed
    )

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        holdingId: holding.id,
        meetingsUpdated: meetings.length,
        changedStocksCount: changedStockIds.size,
      },
      `Updated companies-meetings for holding ${holding.id}`,
    )
  } catch (error) {
    req.payload.logger.error(
      `Error updating companies-meetings for holding: ${JSON.stringify(error)}`,
    )
  }
}
