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
 * Query params: ?limit=10&offset=0
 */
const UserNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    // Authentication check
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pagination parameters from query string
    const url = new URL(req.url || '', 'http://localhost')
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Get user's companies
    const user = req.user
    const userCompanyIds = user?.companies?.map((c) => c?.companyId)

    // Calculate date one month before current date
    const currentDate = new Date()
    const monthBefore = new Date(currentDate)
    monthBefore.setMonth(currentDate.getMonth() - 1)

    // Notification type mapping
    const notificationTypeLabels: Record<string, string> = {
      'after-holding-limit': 'מועד קובע',
      'before-voting-end': 'הצבעה תנעל בקרוב',
      'holdings-not-fed': 'העדר דיווח החזקה',
      'user-impersonation': 'התחזות למשתמש',
      'meeting-updated': 'עודכנה אסיפה ',
      'holdings-gap': 'פערי החזקות',
    }

    // 🚀 SIMPLE APPROACH: Two parallel queries
    const [notificationsResult, unreadCountResult] = await Promise.all([
      // Get paginated notifications
      req.payload.find({
        collection: 'company-meeting-notifications',
        where: {
          company: {
            in: userCompanyIds,
          },
          createdAt: {
            greater_than_equal: monthBefore.toISOString(),
          },
        },
        depth: 0,
        limit,
        page: Math.floor(offset / limit) + 1,
        sort: '-createdAt',
      }),
      
      // Get total unread count (only on first page)
      offset === 0 ? req.payload.count({
        collection: 'company-meeting-notifications',
        where: {
          company: {
            in: userCompanyIds,
          },
          createdAt: {
            greater_than_equal: monthBefore.toISOString(),
          },
          readStatus: { not_equals: true },
        },
      }) : Promise.resolve({ totalDocs: 0 })
    ])

    const notifications = notificationsResult.docs
    const totalDocs = notificationsResult.totalDocs
    const hasNextPage = notificationsResult.hasNextPage
    const totalUnreadCount = unreadCountResult.totalDocs

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
          route = '/'
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

    const resolvedNotifications = await Promise.all(formattedNotifications)

    return Response.json({
      notifications: resolvedNotifications,
      pagination: {
        totalDocs,
        hasNextPage,
        limit,
        offset,
        nextOffset: hasNextPage ? offset + limit : null,
      },
      totalUnreadCount,
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