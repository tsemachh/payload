import type { TaskHandler } from 'payload'
import CheckAdminNotificationsEndPoint from '../collections/admin-notifications/endpoints/CheckAdminNotificationsEndPoint'
import { sanitizeRequest } from './utils'
import { scheduleCheckAdminNotificationsTask } from '@/tasks/scheduleDailyTasks'
export const checkAdminNotificationsHandler: TaskHandler<'checkAdminNotifications'> = async ({
  job,
  req,
}) => {
  try {
    console.log('processMeetingStateHandler', job)
    await sanitizeRequest(req)
    // Call the existing endpoint handler
    const result = await CheckAdminNotificationsEndPoint(req)

    // Parse the response
    const responseData = await result.json()
    //reschedule the task
    await scheduleCheckAdminNotificationsTask(req.payload)
    console.log('processMeetingStateHandler', responseData)
    return {
      output: responseData,
    }
  } catch (error) {
    req.payload.logger.error(`Error in checkAdminNotifications task: ${JSON.stringify(error)}`)
    throw error
  }
}
