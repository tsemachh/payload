import { addDataAndFileToRequest, PayloadRequest } from 'payload'
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

    // Process users-meetings and companies-meetings collections
    await processCompaniesMeetings(req)

    return Response.json({
      success: true,
      message: 'processCompaniesMeetings ended succesfully',
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
