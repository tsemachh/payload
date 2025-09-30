import { PayloadRequest } from 'payload'

/**
 * Endpoint to fix problematic stock relations
 *
 * This endpoint:
 * 1. Finds stocks with fromMagna=true and relatedStock not null
 * 2. Updates these stocks to set relatedStock to null
 * 3. Returns a summary of the changes made
 */
const fixStockRelationsEndPoint = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }
    // Find stocks with fromMagna=true and relatedStock not null
    const problematicStocks = await req.payload.find({
      collection: 'stocks',
      where: {
        and: [{ fromMagna: { equals: true } }, { relatedStock: { not_equals: null } }],
      },
      depth: 0,
      limit: 0,
    })

    console.log(
      `Found ${problematicStocks.totalDocs} problematic stocks with fromMagna=true and relatedStock not null`,
    )

    // Update each problematic stock to set relatedStock to null
    const updatedStocks = []
    for (const stock of problematicStocks.docs) {
      await req.payload.update({
        collection: 'stocks',
        id: stock.id,
        data: {
          relatedStock: null,
        },
        req,
        context: { from: 'process' },
      })
      updatedStocks.push({
        id: stock.id,
        stockId: stock.stockId,
        name: stock.name,
      })
    }

    return Response.json({
      message: `Successfully fixed ${updatedStocks.length} problematic stock relations`,
      updatedStocks,
    })
  } catch (error) {
    console.error('Error fixing stock relations:', error)
    return Response.json({ error: 'Error fixing stock relations' }, { status: 500 })
  }
}
export const getTradableStocks = async (req: PayloadRequest) => {
  try {
    const stocks = await req.payload.find({
      collection: 'stocks',
      where: {
        tradable: {
          equals: true,
        },
      },
      limit: 0,
      depth: 0,
      select: {
        id: true,
        stockId: true,
        name: true,
      },
    })

    return Response.json({ stocks: stocks.docs })
  } catch (error) {
    console.error('❌ Failed to fetch tradable stocks:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export default fixStockRelationsEndPoint
