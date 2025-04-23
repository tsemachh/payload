import { PayloadRequest } from 'payload'
import { processMeetingsFeedCsv } from './processMeetingsFeedCsv'

const uploadMeetingsCsvEndPoint = async (req: PayloadRequest) => {
  try {
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
    // Create a file object from the buffer
    const file = {
      data: buffer,
      name: 'upload.csv',
      size: buffer.length,
      mimetype: 'text/csv',
    }
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Create a new MeetingsFeed document
    const meetingsFeed = await req.payload.create({
      data: { comments: '' },
      collection: 'meetings-feed',
      file: file,
    })
    const errors = await processMeetingsFeedCsv(req, { file })
    return Response.json({
      message: 'Successfully uploaded CSV file',
      stocksFeed: meetingsFeed,
      errors,
    })
  } catch (error) {
    console.error('Error uploading CSV file:', error)
    return Response.json({ error: 'Error uploading CSV file' }, { status: 500 })
  }
}

export default uploadMeetingsCsvEndPoint
