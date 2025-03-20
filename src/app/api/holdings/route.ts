import { NextRequest, NextResponse } from 'next/server'
import payload from 'payload'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
  }

  try {
    const holdings = await payload.find({
      collection: 'holdings',
      where: {
        valueDate: {
          equals: date,
        },
      },
      depth: 2, // To include related stock and account data
    })

    return NextResponse.json(holdings)
  } catch (error) {
    console.error('Error fetching holdings:', error)
    return NextResponse.json({ error: 'Error fetching holdings' }, { status: 500 })
  }
}