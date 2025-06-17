import type { TaskHandler } from 'payload'
import SendAdminMailNotificationsEndpoint from '../collections/admin-notifications/endpoints/SendAdminMailNotificationsEndpoint'
import { sanitizeRequest } from './utils'
import { scheduleAdminMailNotificationsTask } from '@/tasks/scheduleDailyTasks'

export const adminMailNotificationsHandler: TaskHandler<'adminMailNotifications'> = async ({
  job,
  req,
}) => {
  try {
    console.log('adminMailNotificationsHandler', job)
    await sanitizeRequest(req)
    // Call the existing endpoint handler
    const result = await SendAdminMailNotificationsEndpoint(req)

    // Parse the response
    const responseData = await result.json()
    // Reschedule the task
    await scheduleAdminMailNotificationsTask(req.payload)
    console.log('adminMailNotificationsHandler', responseData)
    return {
      output: responseData,
    }
  } catch (error) {
    req.payload.logger.error(`Error in adminMailNotifications task: ${JSON.stringify(error)}`)
    throw error
  }
}