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

    const data = req.data as { meetingId?: string; companyId?: string } | undefined
    const { meetingId, companyId } = data || {}

    if (!meetingId || !companyId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId and companyId',
        },
        { status: 400 },
      )
    }

    // Get the meeting
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return Response.json(
        {
          success: false,
          message: 'Meeting not found',
        },
        { status: 404 },
      )
    }

    if (!meeting.stock || !meeting.holdingsLimit) {
      return Response.json(
        {
          success: false,
          message: 'Meeting must have a stock and holdingsLimit',
        },
        { status: 400 },
      )
    }

    // Get the company
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
      depth: 0,
    })

    if (!company) {
      return Response.json(
        {
          success: false,
          message: 'Company not found',
        },
        { status: 404 },
      )
    }

    // Find all funds for this company
    const fundsForCompany = await req.payload.find({
      collection: 'companies',
      where: {
        and: [{ type: { equals: 'fund' } }, { parentCompany: { equals: companyId } }],
      },
      limit: 0,
      depth: 0,
    })

    if (fundsForCompany.docs.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'No funds found for this company',
        },
        { status: 400 },
      )
    }

    const stockId = getIdOfRelationField(meeting.stock)
    const holdingsLimit = new Date(meeting.holdingsLimit)

    // For each fund, find or create holdings
    const newFundsWithHolding = []
    const addedFunds = []

    for (const fund of fundsForCompany.docs) {
      const fundId = fund.id

      // Check if holdings exist for this fund on the record date
      const { docs: existingHoldings } = await req.payload.find({
        collection: 'holdings',
        where: {
          and: [{ fund: { equals: fundId } }, { valueDate: { equals: holdingsLimit } }],
        },
        limit: 1,
        depth: 0,
      })

      let targetDate = holdingsLimit
      let holdingDoc = existingHoldings[0]

      // If no holdings exist on record date, find latest holdings
      if (!holdingDoc) {
        const { docs: latestHoldings } = await req.payload.find({
          collection: 'holdings',
          where: {
            and: [
              { fund: { equals: fundId } },
              { valueDate: { less_than_equal: holdingsLimit } },
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
        const updatedHoldings = (holdingDoc.holdings || [])
          .filter((h) => h && h.stock)
          .map((h) => {
            const hStock = getIdOfRelationField(h.stock)
            if (hStock === stockId) {
              return {
                stock: hStock,
                quantity: (h.quantity || 0) + 1,
                ...(h.originalForeignData && { originalForeignData: h.originalForeignData }),
              }
            }
            return {
              stock: hStock,
              quantity: h.quantity || 0,
              ...(h.originalForeignData && { originalForeignData: h.originalForeignData }),
            }
          })

        await req.payload.update({
          collection: 'holdings',
          id: holdingDoc.id,
          data: {
            holdings: updatedHoldings as any,
          },
          context: { from: 'process' },
          req,
        })
      } else if (holdingDoc) {
        // Holdings doc exists but doesn't have this stock, add it
        const existingHoldings = (holdingDoc.holdings || [])
          .filter((h) => h && h.stock)
          .map((h) => ({
            stock: getIdOfRelationField(h.stock) as string,
            quantity: h.quantity || 0,
            ...(h.originalForeignData && { originalForeignData: h.originalForeignData }),
          }))

        await req.payload.update({
          collection: 'holdings',
          id: holdingDoc.id,
          data: {
            holdings: [
              ...existingHoldings,
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

      // Add to fundsWithHolding
      newFundsWithHolding.push({
        fund: fundId,
        company: companyId,
        quantity: 1,
        ownedQuantity: 1,
        verifiedHoldings: false,
        original: [],
      })
      addedFunds.push(fundId)
    }

    // Update meeting
    const existingCompanies = (meeting.companies || [])
      .map(getIdOfRelationField)
      .filter((id): id is string => typeof id === 'string')
    const existingFunds = (meeting.funds || [])
      .map(getIdOfRelationField)
      .filter((id): id is string => typeof id === 'string')
    const existingFundsWithHolding = meeting.fundsWithHolding || []

    // Add company if not already present
    const updatedCompanies = existingCompanies.includes(companyId)
      ? existingCompanies
      : [...existingCompanies, companyId]

    // Add funds if not already present
    const updatedFunds = [...new Set([...existingFunds, ...addedFunds])]

    // Merge fundsWithHolding
    const updatedFundsWithHolding = [...existingFundsWithHolding, ...newFundsWithHolding]

    await req.payload.update({
      collection: 'meetings',
      id: meetingId,
      data: {
        companies: updatedCompanies as any,
        funds: updatedFunds as any,
        fundsWithHolding: updatedFundsWithHolding as any,
        changeDetails: `${new Date().toISOString()} - [user] נוספה חברה: ${company.name || companyId}`,
      },
      context: { from: 'process' },
      req,
    })

    return Response.json({
      success: true,
      message: `Company ${company.name || companyId} added successfully`,
      addedFunds: addedFunds.length,
      targetDate: holdingsLimit.toISOString(),
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
