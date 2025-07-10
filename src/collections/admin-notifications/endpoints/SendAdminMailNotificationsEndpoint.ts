import { PayloadRequest } from 'payload'
import { adminMailNotifications } from '@/tasks/adminMailNotifications'

/**
 * Endpoint to send email notifications for admin notifications
 * This endpoint will:
 * 1. Find all unread admin notifications
 * 2. Group them by related user (if any)
 * 3. Send an email to admin users with a summary of notifications
 */
const SendAdminMailNotificationsEndpoint = async (req: PayloadRequest) => {
  try {
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
