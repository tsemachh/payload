import { PayloadRequest } from 'payload'
import { format } from 'date-fns'
import { processMeetingsAgendaFeedCsv } from './processMeetingsAgendaFeedCsv'
import { calculateFileHash, checkDuplicateFileHash } from '@/utils/fileUtils'

const uploadMeetingsAgendaEndPoint = async (req: PayloadRequest) => {
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
    const fileName = `upload_agenda_${formattedDate}.csv`
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

    // Create a new MeetingsFeed document with hash
    const meetingsFeed = await req.payload.create({
      data: {
        comments: {},
      },
      collection: 'meetings-feed',
      file: file,
      req,
    })
    const { errors, successCount, fileLength } = await processMeetingsAgendaFeedCsv(req, { file })
    const endTime = Date.now()
    const durationMs = endTime - startTime
    const durationSeconds = (durationMs / 1000).toFixed(2)

    await req.payload.update({
      collection: 'meetings-feed',
      id: meetingsFeed.id,
      data: {
        comments: {
          errors,
        },
        duration: `${durationSeconds}s`,
        summary: `success: ${successCount} / ${fileLength} `,
      },
      req,
    })

    // Check if a file with the same hash already exists
    const { isDuplicate, existingDoc } = await checkDuplicateFileHash(
      req.payload,
      'meetings-feed',
      fileHash,
    )

    // If duplicate found, return success with existing document
    if (isDuplicate && existingDoc) {
      await req.payload.delete({
        collection: 'meetings-feed',
        id: meetingsFeed.id,
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
        collection: 'meetings-feed',
        id: meetingsFeed.id,
        data: {
          hash: fileHash,
        },
        req,
      })
    }
    return Response.json({
      message: 'Successfully uploaded CSV file',
      stocksFeed: meetingsFeed,
      errors,
      isDuplicate: false,
    })
  } catch (error) {
    console.error('Error uploading CSV file:', error)
    return Response.json({ error: 'Error uploading CSV file' }, { status: 500 })
  }
}

export default uploadMeetingsAgendaEndPoint
