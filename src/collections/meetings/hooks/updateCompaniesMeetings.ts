import { PayloadRequest } from 'payload'
import { processCompaniesMeetings } from '../../companies-meetings/utils/processCompaniesMeetings'
import type { Meeting } from '@/payload-types'

/**
 * Update companies-meetings collection when a meeting is created or updated
 * This function processes the companies-meetings collection for the specific meeting
 * 
 * @param req PayloadRequest object
 * @param meeting The meeting that was created or updated
 */
export const updateCompaniesMeetingsOnMeetingChange = async (
  req: PayloadRequest,
  meeting: Meeting
): Promise<void> => {
  try {
    if (!meeting.stock || !meeting.holdingsLimit) {
      return
    }

    // Process companies-meetings for this specific meeting
    await processCompaniesMeetings(req, [meeting.id])

    req.payload.logger.info(`Updated companies-meetings for meeting ${meeting.id}`)
  } catch (error) {
    req.payload.logger.error(`Error updating companies-meetings for meeting: ${JSON.stringify(error)}`)
  }
}