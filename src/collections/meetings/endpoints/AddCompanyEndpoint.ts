import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { getIdOfRelationField } from '@/utils/utils'
import { processCompaniesMeetings } from '../hooks/processCompaniesMeetings'

/**
 * Endpoint to add a company to a meeting
 * This will:
 * 1. Find or create holdings for the company's funds with quantity 1
 * 2. Add company to companies array
 * 3. Update fundsWithHolding array
 */
const addCompanyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const data = req.data as
      | {
          meetingId?: string
          companyId?: string
          stockId?: string
          holdingLimit?: string
          fundsIds?: string[]
        }
      | undefined
    const { meetingId, companyId, stockId, holdingLimit, fundsIds } = data || {}

    if (!meetingId || !companyId || !stockId || !holdingLimit) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId, companyId, stockId, and holdingLimit',
        },
        { status: 400 },
      )
    }

    if (!fundsIds || fundsIds.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'No fundsIds selected. Please select at least one fundsIds.',
        },
        { status: 400 },
      )
    }

    // Use the selected portfolios instead of finding all funds
    const fundsForCompany = await req.payload.find({
      collection: 'companies',
      where: {
        and: [{ type: { equals: 'fund' } }, { id: { in: fundsIds } }],
      },
      limit: 0,
      depth: 0,
    })

    if (fundsForCompany.docs.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            'No valid portfolios founds. companyId: ' +
            companyId +
            ' fundsIds: ' +
            fundsIds.join(', '),
        },
        { status: 400 },
      )
    }

    const holdingLimitDate = new Date(holdingLimit)

    // For each fund, find or create holdings
    const addedFunds: Array<{ id: string; name: string }> = []
    const existingFunds: Array<{ id: string; name: string }> = []

    for (const fund of fundsForCompany.docs) {
      const fundId = fund.id
      const fundName = fund.name
      let targetDate = holdingLimitDate
      let holdingDoc: any = null

      const { docs: lessThanEqualHolding } = await req.payload.find({
        collection: 'holdings',
        where: {
          and: [{ fund: { equals: fundId } }, { valueDate: { less_than_equal: holdingLimitDate } }],
        },
        sort: '-valueDate',
        limit: 1,
        depth: 0,
      })

      if (lessThanEqualHolding.length > 0) {
        holdingDoc = lessThanEqualHolding[0]
        targetDate = new Date(holdingDoc.valueDate)
      }

      // Check if holding already has the stock
      const existingStockHolding = holdingDoc?.holdings?.find(
        (h: any) => getIdOfRelationField(h.stock) === stockId,
      )

      if (existingStockHolding) {
        // Stock already exists
        existingFunds.push({ id: fundId, name: fundName })
      } else {
        if (holdingDoc) {
          await req.payload.update({
            collection: 'holdings',
            id: holdingDoc.id,
            data: {
              holdings: [
                ...holdingDoc.holdings,
                {
                  stock: stockId,
                  quantity: 1,
                },
              ] as any,
            },
            context: { from: 'process' },
            req,
          })
        } else {
          // No holdings document exists (e.g., for a new fund) — create one
          const newHoldingDoc = await req.payload.create({
            collection: 'holdings',
            data: {
              fund: fundId,
              valueDate: targetDate.toISOString(),
              holdings: [
                {
                  stock: stockId,
                  quantity: 1,
                },
              ] as any,
            },
            context: { from: 'process' },
            req,
          })
          holdingDoc = newHoldingDoc
        }
        addedFunds.push({ id: fundId, name: fundName })
      }
    }

    // Build response message based on results
    if (existingFunds.length === fundsForCompany.docs.length) {
      // All funds already exist
      return Response.json({
        success: false,
        message: 'כל התיקים שנבחרו כבר קיימים באסיפה',
        existingFunds: existingFunds.map((f) => f.name),
        addedFunds: [],
      })
    } else {
      processCompaniesMeetings(req, [meetingId || ''])
      if (existingFunds.length > 0) {
        // Some funds exist, some were added
        return Response.json({
          success: true,
          message: `נוספו ${addedFunds.length} תיקים. ${existingFunds.length} תיקים כבר היו קיימים.`,
          addedFunds: addedFunds.map((f) => f.name),
          existingFunds: existingFunds.map((f) => f.name),
        })
      } else {
        // All funds were added successfully
        return Response.json({
          success: true,
          message: `נוספו ${addedFunds.length} תיקים בהצלחה`,
          addedFunds: addedFunds.map((f) => f.name),
          existingFunds: [],
        })
      }
    }
  } catch (error) {
    req.payload.logger.error(`Error adding company to meeting: ${error}`)
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export default addCompanyEndpoint
