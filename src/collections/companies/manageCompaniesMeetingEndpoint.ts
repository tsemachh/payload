import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import {
  getCompanyFundIds,
  getCompanyNameById,
  getCompanyNamesByIds,
  getRegularCompanies,
} from '../meetings/hooks/activeCompaniesCache'

/**
 * Get all regular companies (type: 'regular') that are active
 * URL: /api/meetings/get-regular-companies
 */
export const getRegularCompaniesEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    // Get regular companies from cache (already filtered to active and type: 'regular')
    const regularCompanies = getRegularCompanies(req.payload)

    // Format to match the expected response structure
    const docs = regularCompanies.map((company) => ({
      id: company.id,
      name: company.name,
    }))

    return Response.json({
      docs,
      totalDocs: docs.length,
    })
  } catch (error) {
    console.error('Error in getRegularCompaniesEndpoint:', error)
    return Response.json(
      { success: false, error: 'Failed to get companies', details: error },
      { status: 500 },
    )
  }
}

/**
 * Get stock details including relations
 * URL: /api/meetings/get-stock-details?stockId=xxx
 */
export const getStockDetailsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const stockId = req.query.stockId as string

    if (!stockId) {
      return Response.json({ error: 'Missing stockId parameter' }, { status: 400 })
    }

    const stock = await req.payload.findByID({
      collection: 'stocks',
      id: stockId,
      depth: 1,
      select: {
        id: true,
        name: true,
        stockId: true,
        relations: true,
      },
    })

    return Response.json(stock)
  } catch (error) {
    console.error('Error in getStockDetailsEndpoint:', error)
    return Response.json(
      { success: false, error: 'Failed to get stock details', details: error },
      { status: 500 },
    )
  }
}

/**
 * Get funds (sub-companies of type 'fund') for a specific company
 * URL: /api/meetings/get-funds-for-company?companyId=xxx
 */
export const getFundsForCompanyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const companyId = req.query.companyId as string

    if (!companyId) {
      return Response.json({ error: 'Missing companyId parameter' }, { status: 400 })
    }

    const companySubCompanies = getCompanyFundIds(companyId, req.payload) || []

    // Get company data for the funds
    const docs = companySubCompanies
      .map((id) => {
        const companyName = getCompanyNameById(id, req.payload)

        return companyName
          ? {
              id,
              name: companyName,
            }
          : null
      })
      .filter((doc) => doc !== null)

    return Response.json({
      docs,
    })
  } catch (error) {
    console.error('Error in getFundsForCompanyEndpoint:', error)
    return Response.json(
      { success: false, error: 'Failed to get funds', details: error },
      { status: 500 },
    )
  }
}

/**
 * Endpoint to get company names by IDs
 * Accepts an array of company IDs and returns an array of objects with id and name
 */
export const getCompanyNamesEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const data = req.data as { companyids?: string[] } | undefined
    const { companyids } = data || {}

    if (!companyids || !Array.isArray(companyids) || companyids.length === 0) {
      return Response.json(
        {
          success: false,
          message: 'Missing or invalid companyids array',
        },
        { status: 400 },
      )
    }

    const companies = getCompanyNamesByIds(companyids, req.payload)
    return Response.json({
      success: true,
      data: companies,
    })
  } catch (error) {
    req.payload.logger.error(`Error getting company names: ${error}`)
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
