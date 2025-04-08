import { PayloadRequest } from 'payload'
import { processHoldingsFeedCsv } from './processHoldingsFeedCsv'

const uploadHoldingsCsvEndPoint = async (req: PayloadRequest) => {
  try {
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get parameters from the request
    const { valueDate, companies } = req.query
    if (!valueDate) {
      return Response.json({ error: 'Value date is required' }, { status: 400 })
    }
    
    // Optional companies parameter as JSON string of company IDs
    let selectedCompanies: string[] = []
    if (companies) {
      try {
        selectedCompanies = JSON.parse(companies as string)
      } catch (e) {
        // If parsing fails, try treating it as a comma-separated string
        selectedCompanies = (companies as string).split(',')
      }
    }

    // Get the ReadableStream from the request body
    const stream = req.body

    if (!stream) {
      return Response.json({ error: "No stream provided" }, { status: 400 })
    }

    // Convert the ReadableStream to a Buffer using the ReadableStream API
    const reader = stream.getReader()
    const chunks = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const buffer = Buffer.concat(chunks)

    // Determine the file extension from the content-type header
    const contentType = req.headers.get('content-type')
    let extension = 'csv'
    let mimetype = 'text/csv'

    if (contentType?.includes('excel') || contentType?.includes('spreadsheetml')) {
      extension = 'xlsx'
      mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    // Create a file object from the buffer
    const file = {
      data: buffer,
      name: `holdings-${valueDate}.${extension}`,
      size: buffer.length,
      mimetype,
    }

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Create a new HoldingsFeed document
    const holdingsFeed = await req.payload.create({
      collection: 'holdings-feed' as any,
      data: {
        valueDate,
        comments: "",
        selectedCompanies: selectedCompanies.length > 0 ? selectedCompanies : undefined,
      } as any,
      file: file,
    })
    //Make sure selectedCompanies are IDs
    holdingsFeed.selectedCompanies=selectedCompanies
    req.file=file
    // Process the holdings feed synchronously
    await processHoldingsFeedCsv(req, holdingsFeed)

    return Response.json({
      message: 'Successfully uploaded holdings file',
      holdingsFeed,
      warnings: {
        /*existingHoldings: existingHoldings.docs.length > 0,
        existingHoldingsCount: existingHoldings.docs.length,*/
      },
    })
  } catch (error) {
    console.error('Error uploading holdings file:', error)
    return Response.json({ error: 'Error uploading holdings file' }, { status: 500 })
  }
}

export default uploadHoldingsCsvEndPoint
