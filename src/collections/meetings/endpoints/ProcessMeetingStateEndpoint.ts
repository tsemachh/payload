import { addDataAndFileToRequest, PayloadRequest } from 'payload'

const ProcessMeetingStateEndpoint = async (req: PayloadRequest) => {
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
    const { docs: scheduledPastMeetings } = await req.payload.update({
      collection: 'meetings',
      where: {
        meetingDate: { less_than: now },
        state: { equals: 'scheduled' },
      },
      data: {
        state: 'completed',
      },
      req: {
        ...req,
        context: { ...req.context, from: 'process' },
      },
    })

    req.payload.logger.info(
      `Updated ${scheduledPastMeetings.length} meetings to 'completed' state. Processed IDs: ${scheduledPastMeetings.map((m) => m.id).join(', ')}`,
    )

    return Response.json({
      success: true,
      message:
        scheduledPastMeetings.length > 0
          ? `Successfully processed ${scheduledPastMeetings.length} meetings and updated users-meetings collection`
          : 'No meetings required state update, but users-meetings collection was updated',
      processedIds: scheduledPastMeetings.map((m) => m.id),
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

export default ProcessMeetingStateEndpoint
