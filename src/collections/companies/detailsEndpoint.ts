import { addDataAndFileToRequest, PayloadRequest } from 'payload'
// Using the global Response object for consistent API responses

export const detailsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }
    // Get user from the request
    const { user } = req

    // Extract company IDs from user object
    const companyIds = [
      ...(user?.funds || []).map((c) => (typeof c === 'string' ? c : c.id)),
      ...(user?.companies || []).map((c) => (typeof c === 'string' ? c : c.companyId)),
    ]
    const uniqueCompanyIds = [...new Set(companyIds)]

    // Build query
    const query: any = {
      collection: 'companies',
      select: {
        id: true,
        companyId: true,
        name: true,
        parentCompany: true,
        subCompanies: true,
        passiveFund: true,
      },
      hidden: true,
      depth: 0,
      limit: 0,
      where: {
        and: [
          {
            id: {
              in: uniqueCompanyIds,
            },
          },
        ],
      },
    }

    // Execute query
    const companies = await req.payload.find(query)

    // Return response
    return Response.json({
      data: companies.docs,
    })
  } catch (error) {
    console.error('Error in companies details endpoint:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export const getVotingRecommendation = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const { companiesIds } = req.query

    if (!companiesIds) {
      return Response.json({ error: 'Company IDs is required' }, { status: 400 })
    }

    const companiesIdsArray = (companiesIds as string).split(',')

    const query: any = {
      collection: 'companies',
      select: {
        id: true,
        'researchDocuments.defaultVotingRecommendation': true,
      },
      depth: 0,
      limit: 0,
      where: {
        and: [
          {
            id: {
              in: companiesIdsArray,
            },
          },
          { 'researchDocuments.defaultVotingRecommendation': { equals: true } },
        ],
      },
    }

    const companies = await req.payload.find(query)

    return Response.json({
      data: companies.docs,
    })
  } catch (error) {
    console.error('Error in companies details endpoint:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
