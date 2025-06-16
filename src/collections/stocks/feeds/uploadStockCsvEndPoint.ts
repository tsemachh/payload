import { PayloadRequest } from 'payload'
import { processStocksFeedCsv } from './processStocksFeedCsv'
import { format } from 'date-fns'
import { calculateFileHash, checkDuplicateFileHash } from '@/utils/fileUtils'

const uploadStockCsvEndPoint = async (req: PayloadRequest) => {
  try {
    const startTime = Date.now()
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    // Get the ReadableStream from the request body
    const stream = req.body

    if (!stream) {
      return Response.json({ error: 'No stream provided' }, { status: 400 })
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
    const now = new Date()
    const formattedDate = format(now, 'dd-MM-yyyy')
    const fileName = `upload_${formattedDate}.csv`
    // Create a file object from the buffer
    const file = {
      data: buffer,
      name: fileName,
      size: buffer.length,
      mimetype: 'text/csv',
    }
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Calculate file hash
    const fileHash = calculateFileHash(buffer)

    // Check if a file with the same hash already exists
    const { isDuplicate, existingDoc } = await checkDuplicateFileHash(
      req.payload,
      'stocks-feed',
      fileHash,
    )

    // If duplicate found, return success with existing document
    if (isDuplicate && existingDoc) {
      return Response.json(
        {
          message: 'File with identical content already exists',
          stocksFeed: existingDoc,
          isDuplicate: true,
        },
        { status: 200 },
      )
    }

    // Create a new StocksFeed document with hash
    const stocksFeed = await req.payload.create({
      data: {
        comments: {},
        hash: fileHash,
      },
      collection: 'stocks-feed',
      file: file,
    })
    // Process the stock feed CSV
    const { processedRows, fileLength } = await processStocksFeedCsv(req, {
      file,
    })
    const endTime = Date.now()
    const durationMs = endTime - startTime
    const durationSeconds = (durationMs / 1000).toFixed(2)
    await req.payload.update({
      collection: 'stocks-feed',
      id: stocksFeed.id,
      data: {
        duration: `${durationSeconds}s`,
        summary: `Stocks processed successfully: ${processedRows} / ${fileLength} `,
      },
    })
    if (fileLength == 0) {
      await req.payload.update({
        collection: 'stocks-feed',
        id: stocksFeed.id,
        data: {
          hash: '',
        },
      })
    }
    return Response.json({
      message: 'Successfully uploaded CSV file',
      stocksFeed,
      isDuplicate: false,
    })
  } catch (error) {
    console.error('Error uploading CSV file:', error)
    return Response.json({ error: 'Error uploading CSV file' }, { status: 500 })
  }
}

export default uploadStockCsvEndPoint
