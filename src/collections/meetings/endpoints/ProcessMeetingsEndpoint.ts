import { PayloadRequest, addDataAndFileToRequest } from 'payload'

const ProcessMeetingsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get current date in ISO format
    const now = new Date().toISOString()

    // Find meetings that should be marked as completed
    const { docs: scheduledPastMeetings } = await req.payload.find({
      collection: 'meetings',
      where: {
        meetingDate: { less_than: now },
        state: { equals: 'scheduled' },
      },
    })

    // Process found meetings
    if (scheduledPastMeetings.length > 0) {
      const updateResults = await Promise.all(
        scheduledPastMeetings.map((meeting) =>
          req.payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: {
              state: 'completed',
              lastProcessed: now,
            },
          }),
        ),
      )

      req.payload.logger.info(
        `Updated ${scheduledPastMeetings.length} meetings to 'completed' state`,
      )

      return Response.json({
        success: true,
        message: `Successfully processed ${scheduledPastMeetings.length} meetings`,
        processedIds: scheduledPastMeetings.map((m) => m.id),
      })
    }

    req.payload.logger.info('No meetings to update during the scheduled process')
    return Response.json({
      success: true,
      message: 'No meetings required processing',
      processedIds: [],
    })
  } catch (error) {
    req.payload.logger.error(`Error processing meetings: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to process meetings',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default ProcessMeetingsEndpoint
