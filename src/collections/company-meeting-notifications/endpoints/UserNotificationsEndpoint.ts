import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Generate route for holdings-gap notification type
 */
const generateHoldingsGapRoute = async (
  req: PayloadRequest,
  meetingId: string,
): Promise<string> => {
  try {
    // Get the meeting to access holdingsLimit
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      return '/holdings'
    }

    const userFunds = req.user?.funds

    // Find the last holdings date before the holdings limit
    const { docs: holdingsDocs } = await req.payload.find({
      collection: 'holdings',
      depth: 0,
      where: {
        and: [
          { valueDate: { less_than_equal: meeting.holdingsLimit } },
          { fund: { in: userFunds } },
        ],
      },
      sort: '-valueDate',
      limit: 1,
    })

    // Use the last holdings date if found, otherwise use holdingsLimit
    const calculatedDate =
      holdingsDocs.length > 0 ? holdingsDocs[0].valueDate : meeting.holdingsLimit

    // Format date to YYYY-MM-DD format in local timezone
    const formattedDate = new Date(calculatedDate).toLocaleDateString('en-CA')

    return `/holdings/view?date=${formattedDate}`
  } catch (error) {
    req.payload.logger.error(`Error generating holdings gap route: ${JSON.stringify(error)}`)
    return '/holdings'
  }
}

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
      'before-voting-end': 'הצבעה תנעל בקרוב',
      'holdings-not-fed': 'העדר דיווח החזקה',
      'user-impersonation': 'התחזות למשתמש',
      'meeting-updated': 'עודכנה אסיפה ',
      'holdings-gap': 'פערי החזקות',
    }

    // Transform notifications to the required format
    const formattedNotifications = notifications.map(async (notification) => {
      const meetingId = (notification.meeting as string) || ''
      const notificationType = notification.notificationType as string
      const notificationTypeLabel = notificationTypeLabels[notificationType] || notificationType
      let route = ''
      switch (notificationType) {
        case 'before-voting-end':
        case 'after-voting-end':
          route = meetingId ? `/vote-meeting/${meetingId}` : ''
          break
        case 'holdings-not-fed':
          route = '/holdings'
          break
        case 'user-impersonation':
          route = '/admin/collections/users'
          break
        case 'meeting-updated':
          route = '/'
          break
        case 'holdings-gap':
          route = await generateHoldingsGapRoute(req, meetingId)
          break
      }
      return {
        id: notification.id,
        title: notificationTypeLabel,
        message: notification.message,
        isRead: notification.readStatus || false,
        createdAt: notification.createdAt,
        route,
      }
    })

    // Wait for all async operations to complete
    const resolvedNotifications = await Promise.all(formattedNotifications)

    return Response.json({
      notifications: resolvedNotifications,
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
