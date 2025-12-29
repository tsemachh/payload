import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import { getCompanyFundIds, getCompanyNameById } from '../hooks/activeCompaniesCache'

/**
 * Get meeting data with companies, removedCompanies, stock, holdingsLimit
 * URL: /api/meetings/get-meeting-data?meetingId=xxx
 */
export const getMeetingDataEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const meetingId = req.query.meetingId as string

    if (!meetingId) {
      return Response.json({ error: 'Missing meetingId parameter' }, { status: 400 })
    }

    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
      select: {
        companies: true,
        removedCompanies: true,
        stock: true,
        holdingsLimit: true,
        stockName: true,
        stockNumber: true,
      },
    })

    // Enhance companies and removedCompanies with names from cache
    const enhancedMeeting = {
      ...meeting,
      companies: ((meeting.companies as string[]) || []).map((companyId: string) => {
        const companyName = getCompanyNameById(companyId)
        return {
          id: companyId,
          name: companyName || '',
        }
      }),
      removedCompanies: ((meeting.removedCompanies as string[]) || []).map((companyId: string) => {
        const companyName = getCompanyNameById(companyId)
        return {
          id: companyId,
          name: companyName || '',
        }
      }),
    }

    return Response.json(enhancedMeeting)
  } catch (error) {
    console.error('Error in getMeetingDataEndpoint:', error)
    return Response.json(
      { success: false, error: 'Failed to get meeting data', details: error },
      { status: 500 },
    )
  }
}

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

    const companies = await req.payload.find({
      collection: 'companies',
      where: {
        type: { equals: 'regular' },
      },
      limit: 0,
      depth: 0,
      select: {
        id: true,
        name: true,
        active: true,
      },
    })

    // Filter only active companies
    const activeCompanies = companies.docs.filter((company: any) => company.active)

    return Response.json({
      docs: activeCompanies,
      totalDocs: activeCompanies.length,
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

    const companySubCompanies = getCompanyFundIds(companyId) || []

    // Get company data for the funds
    const docs = companySubCompanies
      .map((id) => {
        const companyName = getCompanyNameById(id)
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
