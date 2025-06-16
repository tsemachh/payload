import type { TaskHandler } from 'payload'
import CheckNotificationsEndpoint from '../collections/admin-notifications/endpoints/CheckNotificationsEndpoint'
import { sanitizeRequest } from './utils'
import { scheduleCheckNotificationsTask } from '@/tasks/scheduleDailyTasks'
export const checkNotificationsHandler: TaskHandler<'checkNotifications'> = async ({
  job,
  req,
}) => {
  try {
    console.log('processMeetingStateHandler', job)
    await sanitizeRequest(req)
    // Call the existing endpoint handler
    const result = await CheckNotificationsEndpoint(req)

    // Parse the response
    const responseData = await result.json()
    //reschedule the task
    await scheduleCheckNotificationsTask(req.payload)
    console.log('processMeetingStateHandler', responseData)
    return {
      output: responseData,
    }
  } catch (error) {
    req.payload.logger.error(`Error in checkNotifications task: ${JSON.stringify(error)}`)
    throw error
  }
}
