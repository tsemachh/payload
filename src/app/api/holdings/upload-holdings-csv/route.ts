import { NextRequest, NextResponse } from 'next/server'
import { processHoldingsFeedCsv } from '@/collections/holdings/feeds/processHoldingsFeedCsv'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { HoldingsFeed } from '@/payload-types'

export async function POST(request: NextRequest) {
  debugger
  const payload = await getPayload({
    config: configPromise,
  })
  const searchParams = request.nextUrl.searchParams
  const valueDate = searchParams.get('valueDate')
  const companiesParam = searchParams.get('companies')

  if (!valueDate) {
    return NextResponse.json({ error: 'Value date is required' }, { status: 400 })
  }

  try {
    // Parse companies parameter if provided
    let selectedCompanies: string[] = []
    if (companiesParam) {
      try {
        selectedCompanies = JSON.parse(decodeURIComponent(companiesParam))
      } catch (e) {
        // If parsing fails, try treating it as a comma-separated string
        selectedCompanies = companiesParam.split(',')
      }
    }

    // Get the blob from the request
    const fileBlob = await request.blob()
    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer())

    // Determine the file extension from the content-type header
    const contentType = request.headers.get('content-type')
    let extension = 'csv'
    let mimetype = 'text/csv'

    if (contentType?.includes('excel') || contentType?.includes('spreadsheetml')) {
      extension = 'xlsx'
      mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    // Create a file object from the buffer
    const file = {
      data: fileBuffer,
      name: `holdings-${valueDate}.${extension}`,
      size: fileBuffer.length,
      mimetype,
    }

    // Check for existing holdings on the specified date
    const existingHoldings = await payload.find({
      collection: 'holdings',
      where: {
        valueDate: {
          equals: valueDate,
        },
      },
    })

    // Create a new HoldingsFeed document with company selection
    const holdingsFeed = await payload.create({
      collection: 'holdings-feed',
      data: {
        valueDate,
        comments: existingHoldings.docs.length > 0 
          ? `Warning: Replacing ${existingHoldings.docs.length} existing holdings for this date`
          : "",
        selectedCompanies: selectedCompanies,
        processingStatus: 'pending',
      } as HoldingsFeed,
      file: file,
    })

    // Process the holdings feed using our existing processor
    // We create a PayloadRequest-like object for compatibility
    const payloadRequest = {
      payload,
      user: request.headers.get('x-user') 
        ? JSON.parse(request.headers.get('x-user') || '{}') 
        : undefined,
      file,
      context: {},
      query: {
        valueDate,
        companies: JSON.stringify(selectedCompanies)
      },
      headers: {
        get: (name: string) => request.headers.get(name)
      },
      body: fileBuffer
    }

    // Process the feed (this will update the document with results)
    await processHoldingsFeedCsv(payloadRequest as any, holdingsFeed)

    // Return a response with the holdingsFeed ID for polling
    return NextResponse.json({
      message: 'Successfully uploaded holdings file',
      holdingsFeed,
      warnings: {
        existingHoldings: existingHoldings.docs.length > 0,
        existingHoldingsCount: existingHoldings.docs.length,
      },
    })
  } catch (error) {
    console.error('Error uploading holdings file:', error)
    return NextResponse.json({ error: 'Error uploading holdings file' }, { status: 500 })
  }
}