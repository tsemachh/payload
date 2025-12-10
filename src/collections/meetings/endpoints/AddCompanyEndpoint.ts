import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { getIdOfRelationField } from '@/utils/utils'
import { processCompaniesMeetings } from '../hooks/processCompaniesMeetings'

/**
 * Endpoint to add a company to a meeting
 * This will:
 * 1. Find or create holdings for the company's funds with specified quantity
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
          funds?: Array<{ fundId: string; holdingValue: number }>
        }
      | undefined
    const { meetingId, companyId, stockId, holdingLimit, funds } = data || {}

    if (!meetingId || !companyId || !stockId || !holdingLimit) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId, companyId, stockId, and holdingLimit',
        },
        { status: 400 },
      )
    }

    if (!funds || funds.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'No funds selected. Please select at least one fund.',
        },
        { status: 400 },
      )
    }

    // Extract fund IDs and create a map of holding values
    const fundIds = funds.map((f) => f.fundId)
    const fundHoldingMap = new Map(funds.map((f) => [f.fundId, f.holdingValue]))

    // Use the selected portfolios instead of finding all funds
    const fundsForCompany = await req.payload.find({
      collection: 'companies',
      where: {
        and: [{ type: { equals: 'fund' } }, { id: { in: fundIds } }],
      },
      limit: 0,
      depth: 0,
    })

    if (fundsForCompany.docs.length === 0) {
      return Response.json(
        {
          success: false,
          message:
            'No valid portfolios found. companyId: ' +
            companyId +
            ' fundIds: ' +
            fundIds.join(', '),
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
      const holdingValue = fundHoldingMap.get(fundId) || 1 // Get custom value or default to 1
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
                  quantity: holdingValue,
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
              valueDate: holdingLimitDate.toISOString(),
              holdings: [
                {
                  stock: stockId,
                  quantity: holdingValue,
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
      return Response.json({
        success: false,
        message:
          existingFunds.length === 1
            ? 'קיימת החזקה לתיק שנבחר'
            : 'קיימות החזקות עבור כל התיקים שנבחרו ',
        existingFunds: existingFunds.map((f) => f.name),
        addedFunds: [],
      })
    } else {
      // Wait for processCompaniesMeetings to complete before returning
      await processCompaniesMeetings(req, [meetingId || ''])
      if (existingFunds.length > 0) {
        // Some funds exist, some were added
        return Response.json({
          success: true,
          message: `נוס${addedFunds.length === 1 ? 'ף תיק אחד' : `פו ${addedFunds.length} תיקים`}. ${existingFunds.length === 1 ? 'קיימת החזקה עבור תיק אחד' : ` תיקים כבר קיימות החזקות ${existingFunds.length} עבור `} \n.`,
          addedFunds: addedFunds.map((f) => f.name),
          existingFunds: existingFunds.map((f) => f.name),
        })
      } else {
        // All funds were added successfully
        return Response.json({
          success: true,
          message: `נוס${addedFunds.length === 1 ? 'ף תיק אחד' : `פו ${addedFunds.length} תיקים`} בהצלחה`,
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
