import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { getIdOfRelationField } from '@/utils/utils'

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
      | { meetingId?: string; companyId?: string; stockId?: string; holdingLimit?: string }
      | undefined
    const { meetingId, companyId, stockId, holdingLimit } = data || {}

    if (!meetingId || !companyId || !stockId || !holdingLimit) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId, companyId, stockId, and holdingLimit',
        },
        { status: 400 },
      )
    }

    // Find all funds for this company
    const fundsForCompany = await req.payload.find({
      collection: 'companies',
      where: {
        and: [{ type: { equals: 'fund' } }, { parentCompany: { equals: companyId } }], //TODO RACHEL: chang to funds that the cusomer sent!!!!
      },
      limit: 0,
      depth: 0,
    })

    if (fundsForCompany.docs.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'No funds found for this company. companyId: ' + companyId,
        },
        { status: 400 },
      )
    }

    const holdingLimitDate = new Date(holdingLimit)
    const holdingLimitISO = holdingLimitDate.toISOString()

    // For each fund, find or create holdings
    const addedFunds = []

    for (const fund of fundsForCompany.docs) {
      const fundId = fund.id

      // Check if holdings exist for this fund on the record date
      const { docs: existingHoldings } = await req.payload.find({
        collection: 'holdings',
        where: {
          and: [{ fund: { equals: fundId } }, { valueDate: { equals: holdingLimitDate } }],
        },
        limit: 1,
        depth: 0,
      })

      let targetDate = holdingLimitDate
      let holdingDoc = existingHoldings[0]

      // If no holdings exist on record date, find latest holdings
      if (!holdingDoc) {
        const { docs: latestHoldings } = await req.payload.find({
          collection: 'holdings',
          where: {
            and: [
              { fund: { equals: fundId } },
              { valueDate: { less_than_equal: holdingLimitISO } },
            ],
          },
          sort: '-valueDate',
          limit: 1,
          depth: 0,
        })

        if (latestHoldings.length > 0) {
          holdingDoc = latestHoldings[0]
          targetDate = new Date(holdingDoc.valueDate)
        }
      }

      // Check if holding already has the stock
      const existingStockHolding = holdingDoc?.holdings?.find(
        (h: any) => getIdOfRelationField(h.stock) === stockId,
      )

      if (existingStockHolding) {
        // Stock already exists, just update the quantity by adding 1
        // להוציא שגיאה או לא שגיאה אבל לעדכן את הלקוח בפופאפ שההחזקה כבר קיימת
      } else if (holdingDoc) {
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
        // No holdings doc exists, create one
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

      addedFunds.push(fundId)
    }

    return Response.json({
      success: true,
      message: "9090",//`Company ${company.name || companyId} added successfully`,
      addedFunds: addedFunds.length,
      targetDate:"j", //targetDate.toISOString(),
    })
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
