import { PayloadRequest } from 'payload'
import { processMeetingState } from '@/tasks/processMeetingState'

const ProcessMeetingStateEndpoint = async (req: PayloadRequest) => {
  try {
    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }

    // Call the core function with appropriate access control
    const result = await processMeetingState(req)

    // Convert the result to a Response object
    if (result.error === 'forbidden') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (result.error === 'forbidden user') {
      return Response.json({ error: 'forbidden user' }, { status: 403 })
    }

    return Response.json(result)
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
