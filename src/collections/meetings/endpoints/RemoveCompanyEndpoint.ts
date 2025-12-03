import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Endpoint to remove a company from a meeting
 * This will:
 * 1. Add company to removedCompanies array
 * 2. Trigger re-matching to update companies, funds, and fundsWithHolding
 * 3. Delete all votes for that company
 */
const removeCompanyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const data = req.data as { meetingId?: string; companyId?: string } | undefined
    const { meetingId, companyId } = data || {}

    if (!meetingId || !companyId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId and companyId',
        },
        { status: 400 },
      )
    }

    // Get the meeting
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return Response.json(
        {
          success: false,
          message: 'Meeting not found for meetingId: ' + meetingId,
        },
        { status: 404 },
      )
    }

    // Get the company to retrieve its name for logging
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
      depth: 0,
    })

    // Check if company is already in removedCompanies
    // removedCompanies is an array of company IDs (strings) or company objects
    const currentRemovedCompanies = (meeting.removedCompanies || [])
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter((id): id is string => typeof id === 'string')

    if (currentRemovedCompanies.includes(companyId)) {
      return Response.json(
        {
          success: false,
          message: `החברה ${company?.name || companyId} כבר הוסרה מהאסיפה`,
        },
        { status: 400 },
      )
    }

    // Add company to removedCompanies array
    const updatedRemovedCompanies = [...currentRemovedCompanies, companyId]

    // Delete all votes for that company in this meeting
    const voteDeleted = await req.payload.delete({
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingId } }, { company: { equals: companyId } }],
      },
    })

    // Update the meeting with removedCompanies
    await req.payload.update({
      collection: 'meetings',
      id: meetingId,
      data: {
        removedCompanies: updatedRemovedCompanies as string[],
        changeDetails: `${new Date().toISOString()} - [user] הוסרה חברה: ${company?.name || companyId}`,
      },
      context: { from: 'user-action' },
      req,
    })

    return Response.json({
      success: true,
      message: `החברה ${company?.name || companyId} נוספה בהצלחה לחברות המוסרות מהאסיפה`,
      deletedVotes: voteDeleted.docs.length,
    })
  } catch (error) {
    req.payload.logger.error(`Error removing company from meeting: ${error}`)
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export default removeCompanyEndpoint

/**
 * Endpoint to restore a removed company to a meeting
 * This will:
 * 1. Remove company from removedCompanies array
 * 2. Trigger re-matching to update companies, funds, and fundsWithHolding
 */
export const restoreCompanyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const data = req.data as { meetingId?: string; companyId?: string } | undefined
    const { meetingId, companyId } = data || {}

    if (!meetingId || !companyId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: meetingId and companyId',
        },
        { status: 400 },
      )
    }

    // Get the meeting
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return Response.json(
        {
          success: false,
          message: 'Meeting not found for meetingId: ' + meetingId,
        },
        { status: 404 },
      )
    }

    // Get the company to retrieve its name for logging
    const company = await req.payload.findByID({
      collection: 'companies',
      id: companyId,
      depth: 0,
    })

    // Check if company is in removedCompanies
    // removedCompanies is an array of company IDs (strings) or company objects
    const currentRemovedCompanies = (meeting.removedCompanies || [])
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter((id): id is string => typeof id === 'string')

    if (!currentRemovedCompanies.includes(companyId)) {
      return Response.json(
        {
          success: false,
          message: `החברה ${company?.name || companyId} לא נמצאת ברשימת החברות שהוסרו`,
        },
        { status: 400 },
      )
    }

    // Remove company from removedCompanies array
    const updatedRemovedCompanies = currentRemovedCompanies.filter((id) => id !== companyId)

    // Update the meeting
    await req.payload.update({
      collection: 'meetings',
      id: meetingId,
      data: {
        removedCompanies: updatedRemovedCompanies as string[],
        changeDetails: `${new Date().toISOString()} - [user] הוחזרה חברה: ${company?.name || companyId}`,
      },
      context: { from: 'user-action' },
      req,
    })

    return Response.json({
      success: true,
      message: `החברה ${company?.name || companyId} הוסרה ממערך החברות להסרה בהצלחה`,
    })
  } catch (error) {
    req.payload.logger.error(`Error restoring company to meeting: ${error}`)
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
