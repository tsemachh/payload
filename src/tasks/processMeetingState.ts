import type { TaskHandler } from 'payload'
import ProcessMeetingStateEndpoint from '../collections/meetings/endpoints/ProcessMeetingStateEndpoint'
import { sanitizeRequest } from './utils'
import { scheduleProcessMeetingStateTask } from '@/tasks/scheduleDailyTasks'

export const processMeetingStateHandler: TaskHandler<'processMeetingState'> = async ({
  job,
  req,
}) => {
  try {
    await sanitizeRequest(req)
    // Call the existing endpoint handler
    const result = await ProcessMeetingStateEndpoint(req)

    // Parse the response
    const responseData = await result.json()
    //reschedule the task
    await scheduleProcessMeetingStateTask(req.payload)
    return {
      output: responseData,
    }
  } catch (error) {
    req.payload.logger.error(`Error in processMeetingState task: ${JSON.stringify(error)}`)
    throw error
  }
}
