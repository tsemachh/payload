import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { adminMailNotifications } from '@/tasks/adminMailNotifications'
import { isWorkingDay } from '@/collections/meetings/hooks/calculateHoldingDate'

/**
 * Endpoint to send email notifications for admin notifications
 * This endpoint will:
 * 1. Find all unread admin notifications
 * 2. Group them by related user (if any)
 * 3. Send an email to admin users with a summary of notifications
 */
const SendAdminMailNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
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
        success: true,
        message: 'Email notifications are suppressed during non working days',
        emailsSent: { count: 0 },
      })
    }

    // Call the core function
    const result = await adminMailNotifications(req)

    // Convert the result to a Response object
    if (result.error === 'forbidden') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    return Response.json(result)
  } catch (error) {
    req.payload.logger.error(`Error sending admin mail notifications: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to send admin mail notifications',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default SendAdminMailNotificationsEndpoint
