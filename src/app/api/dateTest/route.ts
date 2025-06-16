import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Path to your OpenAPI spec file
    const _d = {
      newDate: new Date(),
      'newDataStr2022-04-24 12:00:00.000': new Date('2022-04-24 12:00:00.000'),
    }
    // Return the JSON content
    return NextResponse.json(JSON.stringify(_d))
  } catch (error) {
    console.error('Error reading or parsing OpenAPI specs:', error)
    return NextResponse.json({ error: 'Failed to load API specifications' }, { status: 500 })
  }
}
