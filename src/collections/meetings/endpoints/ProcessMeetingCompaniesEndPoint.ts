import { PayloadRequest, addDataAndFileToRequest } from 'payload'
import { processCompaniesMeetings } from '../../companies-meetings/utils/processCompaniesMeetings'

const ProcessMeetingCompaniesEndPoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    // Process users-meetings and companies-meetings collections
    await processCompaniesMeetings(req)

    return Response.json({
      success: true,
      message: 'processCompaniesMeetings ended succesfully'

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
