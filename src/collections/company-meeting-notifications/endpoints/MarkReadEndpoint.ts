import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Endpoint to mark a notification as read
 * Path: /api/company-meeting-notifications/mark-read/:id
 * Method: POST
 */
const MarkReadEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get notification ID from URL params
    const notificationId = req.routeParams?.id

    if (!notificationId) {
      return Response.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    // Update the notification's readStatus to true
    const updatedNotification = await req.payload.update({
      collection: 'company-meeting-notifications',
      id: notificationId as string,
      data: {
        readStatus: true,
      },
      req,
    })

    return Response.json({
      success: true,
      notification: updatedNotification,
    })
  } catch (error) {
    req.payload.logger.error(`Error marking notification as read: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to mark notification as read',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default MarkReadEndpoint
