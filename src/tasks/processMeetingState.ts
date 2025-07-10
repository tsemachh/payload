import type { TaskHandler } from 'payload'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { sanitizeRequest } from './utils'
import { scheduleProcessMeetingStateTask } from '@/tasks/scheduleDailyTasks'

/**
 * Core function to process meeting state
 * This function contains the core logic for processing meeting state
 * It is used by both the task handler and the endpoint
 */
export const processMeetingState = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    if (req === null) {
      return { error: 'forbidden', status: 403 }
    }
    if (!req.user) {
      return { error: 'forbidden user', status: 403 }
    }

    // Get current date in ISO format
    const now = new Date().toISOString()

    // Find meetings that should be marked as completed
    const { docs: scheduledPastMeetings } = await req.payload.update({
      collection: 'meetings',
      where: {
        meetingDate: { less_than: now },
        state: { equals: 'scheduled' },
        _status: { equals: 'published' },
      },
      data: {
        state: 'completed',
      },
      req: {
        ...req,
        context: { ...req.context, from: 'process' },
      },
    })

    req.payload.logger.info(
      `Updated ${scheduledPastMeetings.length} meetings to 'completed' state. Processed IDs: ${scheduledPastMeetings.map((m) => m.id).join(', ')}`,
    )

    return {
      success: true,
      message:
        scheduledPastMeetings.length > 0
          ? `Successfully processed ${scheduledPastMeetings.length} meetings and updated users-meetings collection`
          : 'No meetings required state update, but users-meetings collection was updated',
      processedIds: scheduledPastMeetings.map((m) => m.id),
    }
  } catch (error) {
    req.payload.logger.error(`Error processing meetings: ${JSON.stringify(error)}`)
    return {
      success: false,
      error: 'Failed to process meetings',
      details: error,
    }
  }
}

export const processMeetingStateHandler: TaskHandler<'processMeetingState'> = async ({
  job,
  req,
}) => {
  try {
    await sanitizeRequest(req)

    // Call the core function
    const result = await processMeetingState(req)

    // Reschedule the task
    await scheduleProcessMeetingStateTask(req.payload)

    return {
      output: result,
    }
  } catch (error) {
    req.payload.logger.error(`Error in processMeetingState task: ${JSON.stringify(error)}`)
    throw error
  }
}
