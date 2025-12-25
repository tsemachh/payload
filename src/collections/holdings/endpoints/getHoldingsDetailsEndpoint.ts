import type { PayloadHandler } from 'payload'

const getHoldingsDetailsEndpoint: PayloadHandler = async (req) => {
  try {
    const { fundId, stockId, holdingLimitDate } = req.query

    req.payload.logger.info({
      msg: 'Holdings details request',
      fundId,
      stockId,
      holdingLimitDate,
    })

    if (!fundId || !stockId || !holdingLimitDate) {
      return Response.json(
        {
          success: false,
          message: 'Missing required parameters: fundId, stockId, holdingLimitDate',
        },
        { status: 400 },
      )
    }

    const limitDate = new Date(holdingLimitDate as string)

    // Calculate date range: 5 days before and 2 days after
    const startDate = new Date(limitDate)
    startDate.setDate(startDate.getDate() - 5)

    const endDate = new Date(limitDate)
    endDate.setDate(endDate.getDate() + 2)

    req.payload.logger.info({
      msg: 'Date range',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })

    // Fetch holdings within the date range
    const { docs: holdings } = await req.payload.find({
      collection: 'holdings',
      select: { holdings: true, valueDate: true },
      where: {
        and: [
          { fund: { equals: fundId } },
          { valueDate: { greater_than_equal: startDate.toISOString() } },
          { valueDate: { less_than_equal: endDate.toISOString() } },
        ],
      },
      sort: '-valueDate',
      depth: 0,
      limit: 10,
    })

    req.payload.logger.info({
      msg: 'Holdings found',
      count: holdings.length,
      holdings: holdings.map((h: any) => ({
        id: h.id,
        valueDate: h.valueDate,
        holdingsCount: h.holdings?.length,
      })),
    })

    // Extract holdings for the specific stock
    const holdingsDetails = holdings
      .map((holding: any) => {
        const stockHolding = holding.holdings?.find(
          (h: any) => h.stock === stockId || h.stock?.id === stockId,
        )
        if (stockHolding) {
          return {
            valueDate: holding.valueDate,
            quantity: stockHolding.quantity || 0,
          }
        }
        return null
      })
      .filter((h: any) => h !== null)
      .sort((a: any, b: any) => new Date(b!.valueDate).getTime() - new Date(a!.valueDate).getTime())

    req.payload.logger.info({
      msg: 'Holdings details extracted',
      count: holdingsDetails.length,
      details: holdingsDetails,
    })

    return Response.json({
      success: true,
      holdings: holdingsDetails,
    })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: 'Error fetching holdings details' })
    return Response.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 },
    )
  }
}

export default getHoldingsDetailsEndpoint
