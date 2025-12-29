import { addDataAndFileToRequest, PayloadRequest, Where } from 'payload'
import { processCompaniesMeetings } from '../hooks/processCompaniesMeetings'

const ProcessMeetingCompaniesEndPoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }
    // @ts-expect-error req not null
    const data = await req.json()
    // If where provided, pre-select meeting IDs to process, otherwise allow internal default selection
    const meetingIds: string[] | undefined = data.selectedIds || []
    const startedAt = Date.now()
    await processCompaniesMeetings(req, meetingIds)
    const durationMs = Date.now() - startedAt

    return Response.json({
      success: true,
      processed: Array.isArray(meetingIds) ? meetingIds?.length : 'all',
      durationMs,
      message: 'processCompaniesMeetings completed',
    })
  } catch (error) {
    req.payload.logger.error(`Error processing processCompaniesMeetings: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to process processCompaniesMeetings',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default ProcessMeetingCompaniesEndPoint
