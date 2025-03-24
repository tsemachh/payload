import { NextRequest, NextResponse } from 'next/server'

import configPromise from '@payload-config'
import { getPayload, Where } from 'payload'

export const GET = async (request: NextRequest) => {
  const payload = await getPayload({
    config: configPromise,
  })
  const searchParams = request.nextUrl.searchParams
  const valueDate = searchParams.get('date')
  const companies = searchParams.get('companies')

  if (!valueDate) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
  }

  try {
    const where: Where = {
      valueDate: {
        equals: new Date(valueDate).toISOString()
      }
    }

    // If companies are specified, filter by them
    if (companies) {
      const companyIds = companies.split(',')
      const companiesResponse = await payload.find({
        collection: 'companies',
        where: {
          id: {
            in: companyIds,
          },
        },
        limit: 1000,
        depth: 0
      })
      let accountIds: string[] = [];
      companiesResponse.docs.forEach((company) => {
        const accounts = company.accounts?.docs as string[]
        accountIds = accountIds.concat(accounts)
      })
      // Only filter by accounts if we found accounts for the companies
      if (accountIds.length > 0) {
        where.account = {
          in: accountIds,
        }
      }
    }
    console.log('Where',JSON.stringify(where))
    const holdings = await payload.find({
      collection: 'holdings',
      where,
      depth: 2, // To include related stock and account data
      limit: 1000,
    })

    return NextResponse.json(holdings)
  } catch (error) {
    console.error('Error fetching holdings:', error)
    return NextResponse.json({ error: 'Error fetching holdings' }, { status: 500 })
  }
}