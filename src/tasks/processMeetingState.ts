import type { TaskHandler } from 'payload'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { sanitizeRequest } from './utils'
import { scheduleProcessMeetingStateTask } from '@/tasks/scheduleDailyTasks'
import { isHolidayOrShabbat } from '@/collections/meetings/hooks/calculateHoldingDate'
import { revertToPublished } from '@/utils/utils'

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

    if (isHolidayOrShabbat(new Date())) {
      return {
        success: true,
        message: 'non working day',
      }
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
        context: { ...req.context, process: 'processMeetingState' },
      },
    })

    req.payload.logger.info(
      `Updated ${scheduledPastMeetings.length} meetings to 'completed' state. Processed IDs: ${scheduledPastMeetings.map((m) => m.id).join(', ')}`,
    )

    // Initialize vote statistics
    let totalVotesProcessed = 0
    let votesSuccessfullyReverted = 0
    let votesFailed = 0
    let votesWithNoPublishedVersion = 0

    // Process votes for each meeting
    for (const meeting of scheduledPastMeetings) {
      // Find all votes associated with this meeting
      const { docs: meetingVotes } = await req.payload.find({
        collection: 'votes',
        where: {
          meeting: { equals: meeting.id },
          _status: { equals: 'draft' },
        },
        depth: 0,
        limit: 0,
        draft: true,
      })

      totalVotesProcessed += meetingVotes.length
      req.payload.logger.info(`Found ${meetingVotes.length} draft votes for meeting ${meeting.id}`)

      // For each draft vote, revert to the last published version
      for (const vote of meetingVotes) {
        try {
          // Use the revertToPublished utility function
          const revertResult = await revertToPublished(req, 'votes', vote.id)

          if (revertResult.success) {
            votesSuccessfullyReverted++
            req.payload.logger.info(
              `Successfully reverted draft vote ${vote.id} to published version for meeting ${meeting.id}`,
            )
          } else if (revertResult.reason === 'no-published-version') {
            votesWithNoPublishedVersion++
            req.payload.logger.warn(
              `No published version found for draft vote ${vote.id} for meeting ${meeting.id}`,
            )
          } else {
            votesFailed++
            req.payload.logger.error(
              `Error reverting draft vote ${vote.id} for meeting ${meeting.id}: ${JSON.stringify(revertResult.error)}`,
            )
          }
        } catch (error) {
          votesFailed++
          req.payload.logger.error(
            `Error reverting draft vote ${vote.id} for meeting ${meeting.id}: ${JSON.stringify(error)}`,
          )
        }
      }
    }

    return {
      success: true,
      message:
        scheduledPastMeetings.length > 0
          ? `Successfully processed ${scheduledPastMeetings.length} meetings and updated users-meetings collection`
          : 'No meetings required state update, but users-meetings collection was updated',
      processedIds: scheduledPastMeetings.map((m) => m.id),
      stats: {
        meetingsProcessed: scheduledPastMeetings.length,
        votesProcessed: totalVotesProcessed,
        votesSuccessfullyReverted: votesSuccessfullyReverted,
        votesFailed: votesFailed,
        votesWithNoPublishedVersion: votesWithNoPublishedVersion,
      },
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
    await sanitizeRequest(req, 'processMeetingState')

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
