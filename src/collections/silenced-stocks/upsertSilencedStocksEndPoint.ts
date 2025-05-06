import { PayloadRequest } from 'payload'

const checkUserAuthorization = (req: PayloadRequest) => {
  if (!req?.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
}

const validateQueryParams = (stockId: string, companiesArray: string[]) => {
  if (typeof stockId !== 'string' || !stockId) {
    return Response.json({ error: 'Missing or invalid stockId' }, { status: 400 })
  }
  if (!Array.isArray(companiesArray)) {
    return Response.json({ error: 'Missing or invalid companies' }, { status: 400 });
  }
}

const updateCompanySilencedStocks = async (req: PayloadRequest, stockId: string, companyId: string) => {
  try {
    // Get the company
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
    })

    // Check if the stock is already silenced for this company
    const silencedStocks = company.silencedStocks || []
    const stockExists = silencedStocks.includes(stockId)

    // If the stock is already silenced, no need to update
    if (stockExists) {
      return { success: true, message: 'Stock already silenced for this company' }
    }

    // Add the stock to the silenced stocks
    const updatedSilencedStocks = [...silencedStocks, stockId]

    // Update the company
    return await req.payload.update({
      collection: 'companies',
      id: companyId,
      data: {
        silencedStocks: updatedSilencedStocks,
      },
    })
  } catch (error) {
    console.error(`Error updating silenced stocks for company ${companyId}:`, error)
    throw error
  }
}

const upsertSilencedStocksEndPoint = async (req: PayloadRequest) => {
  try {
    const authError = checkUserAuthorization(req)
    if (authError) return authError

    const { companies } = req.query as {companies: string }
    // @ts-expect-error req not null
    const stock = await req.json()
    const stockId=stock.stockId

    const companiesArray = companies.split(',');
    const queryParamError = validateQueryParams(stockId, companiesArray)
    if (queryParamError) return queryParamError

    // Update each company with the silenced stock
    const results = []
    for (const companyId of companiesArray) {
      try {
        const result = await updateCompanySilencedStocks(req, stockId, companyId)
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
