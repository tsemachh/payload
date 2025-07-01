import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Endpoint to get all notifications for the companies the user has
 * Path: /api/company-meeting-notifications/user-notifications
 * Method: GET
 */
const UserNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's companies
    const user = req.user

    const userCompanyIds = user?.companies?.map((c) => c?.companyId)

    // Calculate date one month before current date
    const currentDate = new Date()
    const monthBefore = new Date(currentDate)
    monthBefore.setMonth(currentDate.getMonth() - 1)

    // Find notifications for the user's companies
    const { docs: notifications } = await req.payload.find({
      collection: 'company-meeting-notifications',
      where: {
        company: {
          in: userCompanyIds,
        },
        createdAt: {
          greater_than_equal: monthBefore.toISOString(),
        },
      },
      depth: 0, // To get meeting data
      limit: 0,
    })

    // Notification type mapping
    const notificationTypeLabels: Record<string, string> = {
      'after-holding-limit': 'מועד קובע',
      'before-voting-end': 'סגירת הצבעה',
      'holdings-not-fed': 'דיווח אחזקה',
    }

    // Transform notifications to the required format
    const formattedNotifications = notifications.map((notification) => {
      const meetingId = (notification.meeting as string) || ''
      const notificationType = notification.notificationType as string
      const notificationTypeLabel = notificationTypeLabels[notificationType] || notificationType

      return {
        id: notification.id,
        title: notificationTypeLabel,
        message: notification.message,
        isRead: notification.readStatus || false,
        createdAt: notification.createdAt,
        route: meetingId ? `/vote-meeting/${meetingId}` : '',
      }
    })

    return Response.json({
      notifications: formattedNotifications,
    })
  } catch (error) {
    req.payload.logger.error(`Error fetching user notifications: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to fetch user notifications',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default UserNotificationsEndpoint
