import { PayloadRequest } from 'payload'
import { sendCompanyMeetingNotifications } from '@/tasks/sendCompanyMeetingNotifications'
import { isWorkingDay } from '@/collections/meetings/hooks/calculateHoldingDate'

/**
 * Endpoint to send company meeting notifications
 * This endpoint allows testing the sendCompanyMeetingNotifications job functionality
 */
const SendCompanyMeetingNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }
    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }

    // Check if it's a working day
    if (!isWorkingDay(new Date())) {
      return Response.json({
        details: {
          success: true,
          message: 'Company meeting notifications are suppressed during non working days',
          summary: {
            notificationsFound: 0,
            companiesProcessed: 0,
            emailsSent: 0,
            emailErrors: 0,
            notificationsByType: {
              afterHoldingLimit: 0,
              beforeVotingEnd: 0,
            },
          },
          companyDetails: [],
        },
      })
    }

    // Call the core function directly
    const result = await sendCompanyMeetingNotifications(req)

    return Response.json(
      {
        details: result,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error(
      `Error in sendCompanyMeetingNotifications endpoint: ${JSON.stringify(error)}`,
    )
    return Response.json(
      {
        success: false,
        error: 'Error in sendCompanyMeetingNotifications endpoint',
        details: error,
      },
      { status: 500 },
    )
  }
}
export default SendCompanyMeetingNotificationsEndpoint
