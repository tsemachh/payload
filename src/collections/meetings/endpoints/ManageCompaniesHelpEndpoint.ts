import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import {
  getCompanyFundIds,
  getCompanyNameById,
} from '../hooks/activeCompaniesCache'

/**
 * Endpoint to help manage companies in meetings
 * Consolidates multiple API calls into a single endpoint with action mapping
 */
export const manageCompaniesHelpEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const action = req.query.action as string

    if (!action) {
      return Response.json({ error: 'Missing action parameter' }, { status: 400 })
    }

    switch (action) {
      case 'getMeetingData':
        return await getMeetingData(req)

      case 'getRegularCompanies':
        return await getRegularCompanies(req)

      case 'getStockDetails':
        return await getStockDetails(req)

      case 'getFundsForCompany':
        return await getFundsForCompany(req)

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in manageCompaniesHelpEndpoint:', error)
    return Response.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error,
      },
      { status: 500 },
    )
  }
}

/**
 * Get meeting data with companies, removedCompanies, stock, holdingsLimit, stockName, stockNumber
 */
async function getMeetingData(req: PayloadRequest) {
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

  return Response.json(meeting)
}

/**
 * Get all regular companies (type: 'regular') that are active
 */
async function getRegularCompanies(req: PayloadRequest) {
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
}

/**
 * Get stock details including relations
 */
async function getStockDetails(req: PayloadRequest) {
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
}

/**
 * Get funds (sub-companies of type 'fund') for a specific company
 */
async function getFundsForCompany(req: PayloadRequest) {
  const companySubCompanies = getCompanyFundIds(req.query.companyId as string) || []

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
}

export default manageCompaniesHelpEndpoint
