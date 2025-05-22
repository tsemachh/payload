import { PayloadRequest } from 'payload'
// Using the global Response object for consistent API responses

const detailsEndpoint = async (req: PayloadRequest) => {
  try {
    // Get user from the request
    const { user } = req

    // Extract company IDs from user object
    const companyIds = [
      ...(user?.leafCompanies || []).map((c) => (typeof c === 'string' ? c : c.id)),
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

export default detailsEndpoint
