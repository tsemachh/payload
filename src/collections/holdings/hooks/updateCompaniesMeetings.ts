import { PayloadRequest } from 'payload'
import { processCompaniesMeetings } from '@/collections/meetings/hooks/processCompaniesMeetings'
import type { Holding } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

/**
 * Update companies-meetings collection when a holding is created or updated
 * This function:
 * 1. Gets the company associated with the account in the holding
 * 2. Gets meetings that have the same stock and holdingsLimit date as the holding
 * 3. Processes the companies-meetings collection for the specific company and meetings
 *
 * @param req PayloadRequest object
 * @param holding The holding that was created or updated
 */
export const updateCompaniesMeetingsOnHoldingChange = async (
  req: PayloadRequest,
  holding: Holding,
): Promise<void> => {
  try {
    if (!holding.fund || !holding.valueDate) {
      return
    }

    const stockIds = holding.holdings.map((holding) => holding.stock).map(getIdOfRelationField)
    // Get meetings with the same stock and holdingsLimit date
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      select: {},
      where: {
        and: [
          { stock: { in: stockIds } },
          { holdingsLimit: { greater_than_equal: holding.valueDate } },
        ],
      },
      limit: 0,
    })

    if (meetings.length === 0) {
      return
    }

    // Process companies-meetings for the specific company and meetings
    await processCompaniesMeetings(
      req,
      meetings.map((meeting) => meeting.id),
    )

    req.payload.logger.info(`Updated companies-meetings for holding ${holding.id}`)
  } catch (error) {
    req.payload.logger.error(
      `Error updating companies-meetings for holding: ${JSON.stringify(error)}`,
    )
  }
}
