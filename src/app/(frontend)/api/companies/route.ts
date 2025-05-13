import { NextRequest, NextResponse } from 'next/server'
import { fetchCompanies, fetchCompanyById } from '../../helpers/utils-company'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    // If ID is provided, fetch a single company
    if (id) {
      const company = await fetchCompanyById(id)
      return NextResponse.json(company)
    }

    const companies = await fetchCompanies()
    return NextResponse.json(companies)
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}
