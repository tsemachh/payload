import { PayloadRequest } from 'payload'

const checkUserAuthorization = (req: PayloadRequest) => {
  if (!req?.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
}

const validateQueryParams = (stockIds: string[], companiesArray: string[]) => {
  if (!Array.isArray(stockIds) || stockIds.length === 0) {
    return Response.json({ error: 'Missing or invalid stockIds' }, { status: 400 })
  }
  if (!Array.isArray(companiesArray)) {
    return Response.json({ error: 'Missing or invalid companies' }, { status: 400 })
  }
}

const updateCompanySilencedStocks = async (
  req: PayloadRequest,
  stockIds: string[],
  companyId: string,
) => {
  try {
    // Get the company
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
    })

    // Check which stocks are not already silenced for this company
    const silencedStocks = company.silencedStocks || []
    const newStockIds = stockIds.filter((stockId) => !silencedStocks.includes(stockId))

    // If all stocks are already silenced, no need to update
    if (newStockIds.length === 0) {
      return {
        success: true,
        message: 'All stocks already silenced for this company',
        addedCount: 0,
      }
    }

    // Add the new stocks to the silenced stocks
    const updatedSilencedStocks = [...silencedStocks, ...newStockIds]

    // Update the company
    const result = await req.payload.update({
      collection: 'companies',
      id: companyId,
      data: {
        silencedStocks: updatedSilencedStocks,
      },
    })

    return {
      ...result,
      addedCount: newStockIds.length,
    }
  } catch (error) {
    console.error(`Error updating silenced stocks for company ${companyId}:`, error)
    throw error
  }
}

const upsertSilencedStocksEndPoint = async (req: PayloadRequest) => {
  try {
    const authError = checkUserAuthorization(req)
    if (authError) return authError

    const { companies } = req.query as { companies: string }
    // @ts-expect-error req not null
    const body = await req.json()
    const stockIds = Array.isArray(body.stockIds) ? body.stockIds : [body.stockId].filter(Boolean)

    const companiesArray = companies.split(',')
    const queryParamError = validateQueryParams(stockIds, companiesArray)
    if (queryParamError) return queryParamError

    // Update each company with the silenced stocks
    const results = []
    for (const companyId of companiesArray) {
      try {
        const result = await updateCompanySilencedStocks(req, stockIds, companyId)
        results.push({ companyId, success: true, result })
      } catch (error) {
        results.push({ companyId, success: false, error: String(error) })
      }
    }

    return Response.json({ feedResult: results })
  } catch (error) {
    console.error('Error processing silenced stock:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default upsertSilencedStocksEndPoint
