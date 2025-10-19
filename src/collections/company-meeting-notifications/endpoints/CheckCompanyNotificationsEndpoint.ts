import { PayloadRequest } from 'payload'
import { checkCompanyNotifications } from '@/tasks/checkCompanyNotifications'
import { isWorkingDay } from '@/collections/meetings/hooks/calculateHoldingDate'

/**
 * Endpoint to check company notifications
 * This endpoint allows testing the checkCompanyNotifications job functionality
 */
export const CheckCompanyNotificationsEndpoint = async (req: PayloadRequest) => {
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
          message: 'Company notifications are suppressed during non working days',
          summary: {
            meetingsProcessed: 0,
            companiesChecked: 0,
            notificationsCreated: {
              afterHoldingLimit: 0,
              beforeVotingEnd: 0,
              holdingsNotFed: 0,
            },
          },
          meetingDetails: [],
        },
      })
    }

    // Call the core function directly
    const result = await checkCompanyNotifications(req)
    return Response.json(
      {
        details: result,
      },
      { status: 200 },
    )
  } catch (error) {
    req.payload.logger.error(
      `Error in checkCompanyNotifications endpoint: ${JSON.stringify(error)}`,
    )
    return Response.json(
      {
        success: false,
        error: 'Error in checkCompanyNotifications endpoint',
        details: error,
      },
      { status: 500 },
    )
  }
}
