import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers.js'

export async function GET() {
  try {
    // Initialize payload
    const payload = await getPayload({ config })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    const companyIds = [
      ...(user?.leafCompanies || []).map((c) => (typeof c === 'string' ? c : c.id)),
      ...(user?.companies || []).map((c) => (typeof c === 'string' ? c : c.companyId)),
    ]
    const uniqueCompanyIds = [...new Set(companyIds)]
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
      depth: 1,
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
    const companies = await payload.find(query)

    // Return response
    return NextResponse.json({
      data: companies.docs,
    })
  } catch (error) {
    console.error('Error in /api/companies:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
