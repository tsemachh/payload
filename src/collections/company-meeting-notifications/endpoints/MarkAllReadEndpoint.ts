import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Endpoint to mark all notifications as read for the current user
 * Path: /api/company-meeting-notifications/mark-all-read
 * Method: POST
 */
const MarkAllReadEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's companies
    const user = req.user
    const userCompanyIds = user?.companies?.map((c) => c?.companyId)

    if (!userCompanyIds || userCompanyIds.length === 0) {
      return Response.json({
        success: true,
        message: 'No companies found for user',
      })
    }

    // Find all unread notifications for the user's companies
    const { docs: unreadNotifications } = await req.payload.update({
      collection: 'company-meeting-notifications',
      where: {
        company: {
          in: userCompanyIds,
        },
      },
      data: {
        readStatus: true,
      },
      req: {
        ...req,
        context: { ...req.context, process: 'markAllNotificationsRead' },
      },
    })

    return Response.json({
      success: true,
      message: `Marked ${unreadNotifications.length} notifications as read`,
    })
  } catch (error) {
    req.payload.logger.error(`Error marking all notifications as read: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to mark all notifications as read',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default MarkAllReadEndpoint
