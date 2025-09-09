import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { checkAdminNotifications } from '@/tasks/checkAdminNotifications'

/**
 * Endpoint to check for various conditions and create notifications
 * 1. Companies not feeding holdings for more than 2 working days
 * 2. Companies not voting on meetings happening in the next working day
 * 3. No feed from Predictae (stocks or meetings) in the past working day
 */
const CheckAdminNotificationsEndPoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }
    if (!req.user.isAdmin) {
      return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
    }
    // Call the core function
    const result = await checkAdminNotifications(req)

    // Convert the result to a Response object
    if (result.error === 'forbidden') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    return Response.json(result)
  } catch (error) {
    req.payload.logger.error(`Error checking notifications: ${JSON.stringify(error)}`)
    return Response.json(
      {
        success: false,
        error: 'Failed to check notifications',
        details: error,
      },
      { status: 500 },
    )
  }
}

export default CheckAdminNotificationsEndPoint
