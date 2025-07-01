import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { processStocksFeedCsv } from './processStocksFeedCsv'
import { format } from 'date-fns'
import { calculateFileHash, checkDuplicateFileHash } from '@/utils/fileUtils'

const uploadStockCsvEndPoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
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

    // Create a new StocksFeed document with hash
    const stocksFeed = await req.payload.create({
      data: {
        comments: {},
      },
      collection: 'stocks-feed',
      file: file,
      req,
    })
    // Process the stock feed CSV
    const { processedRows, fileLength, errors } = await processStocksFeedCsv(
      req,
      {
        file,
      },
      stocksFeed,
    )
    const endTime = Date.now()
    const durationMs = endTime - startTime
    const durationSeconds = (durationMs / 1000).toFixed(2)
    await req.payload.update({
      collection: 'stocks-feed',
      id: stocksFeed.id,
      data: {
        comments: {
          errors,
        },
        duration: `${durationSeconds}s`,
        summary: `Stocks processed successfully: ${processedRows} / ${fileLength} `,
      },
      req,
    })
    // Check if a file with the same hash already exists
    const { isDuplicate, existingDoc } = await checkDuplicateFileHash(
      req.payload,
      'stocks-feed',
      fileHash,
    )

    // If duplicate found, return success with existing document
    if (isDuplicate && existingDoc) {
      await req.payload.delete({
        collection: 'stocks-feed',
        id: stocksFeed.id,
      })
      return Response.json(
        {
          message: 'File with identical content already exists',
          stocksFeed: existingDoc,
          isDuplicate: true,
        },
        { status: 200 },
      )
    } else {
      await req.payload.update({
        collection: 'stocks-feed',
        id: stocksFeed.id,
        data: {
          hash: fileHash,
        },
        req,
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
