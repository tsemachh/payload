import { NextRequest, NextResponse } from 'next/server'
import payload from 'payload'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    if (!id) {
      return NextResponse.json({ error: 'Feed ID is required' }, { status: 400 })
    }

    const holdingsFeed = await payload.findByID({
      collection: 'holdings-feed' as any,
      id,
    })

    return NextResponse.json(holdingsFeed)
  } catch (error) {
    console.error('Error fetching holdings feed:', error)
    return NextResponse.json({ error: 'Error fetching holdings feed' }, { status: 500 })
  }
}