import { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { Meeting, Vote, VotesReportStatus, VotesStatus } from '@/payload-types'

/**
 * Function to manually recalculate vote counts for a specific meeting
 * This can be used by an admin endpoint for manual recalculation
 * @returns Object with success status, message, and updated data
 */
export async function recalculateMeetingVoteCounts(
  req: PayloadRequest,
  meetingId: string,
): Promise<
  | {
      success: boolean
      message: string
      data: {
        votesCount: number
        reportVotesCount: number
        votesStatus: VotesStatus
        votesReportStatus: VotesReportStatus
      }
    }
  | undefined
> {
  try {
    // Get the meeting with all votes and companies
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      select: {
        votes: true,
        companies: true,
        votesCount: true,
        reportVotesCount: true,
      },
      id: meetingId,
      depth: 1,
    })

    if (!meeting) {
      throw new Error(`Meeting with ID ${meetingId} not found`)
    }

    // Count reported votes
    const newReportVotesCount =
      meeting?.votes?.docs?.filter((vote) => (vote as Vote).reported === true).length || 0
    // Calculate status indicators
    const companiesCount = meeting.companies?.length || 0
    //vote Count
    const newVotesCount = meeting?.votes?.docs?.length || 0
    // Calculate vote statuses using the utility function
    if (newReportVotesCount != meeting.reportVotesCount || newVotesCount != meeting.votesCount) {
      const { votesStatus, votesReportStatus } = calculateVoteStatuses(
        newVotesCount,
        newReportVotesCount,
        companiesCount,
      )

      // Update the meeting with calculated values
      await req.payload.update({
        collection: 'meetings',
        id: meetingId,
        data: {
          votesCount: newVotesCount,
          reportVotesCount: newReportVotesCount,
          votesStatus,
          votesReportStatus,
        },
        req: {
          ...req,
          context: { ...req.context, from: 'migration' },
        },
      })

      return {
        success: true,
        message: `Updated meeting ${meetingId}: votes=${newVotesCount}, reported=${newReportVotesCount}`,
        data: {
          votesCount: newVotesCount,
          reportVotesCount: newReportVotesCount,
          votesStatus,
          votesReportStatus,
        },
      }
    }
  } catch (error) {
    console.error(`Error recalculating vote counts for meeting ${meetingId}:`, error)
    throw error
  }
}

/**
 * Calculate vote status indicators based on vote counts
 * @param votesCount - Number of votes
 * @param reportVotesCount - Number of report votes
 * @param companiesCount - Number of companies
 * @returns Object containing votesStatus and votesReportStatus
 */
export function calculateVoteStatuses(
  votesCount: number,
  reportVotesCount: number,
  companiesCount: number,
): { votesStatus: VotesStatus; votesReportStatus: VotesReportStatus } {
  // Calculate votesStatus based on votesCount vs companiesCount
  let votesStatus: VotesStatus = 'None'
  if (votesCount === 0) {
    votesStatus = 'None'
  } else if (votesCount >= companiesCount && companiesCount > 0) {
    votesStatus = 'All'
  } else {
    votesStatus = 'Partial'
  }

  // Calculate votesReportStatus based on reportVotesCount vs votesCount
  let votesReportStatus: VotesReportStatus = 'None'
  if (reportVotesCount === 0) {
    votesReportStatus = 'None'
  } else if (reportVotesCount >= votesCount && votesCount > 0) {
    votesReportStatus = 'All'
  } else {
    votesReportStatus = 'Partial'
  }

  return { votesStatus, votesReportStatus }
}

/**
 * Hook to track changes to the companies array in a meeting and update vote status indicators
 * This hook runs after a meeting document is changed and detects when:
 * - The companies array is modified (added, removed, or changed)
 * - Recalculates votesStatus and votesReportStatus based on the new companies count
 */
export const updateVoteStatusOnCompaniesChange: CollectionBeforeChangeHook<Meeting> = async ({
  data,
  originalDoc,
  req,
  operation,
}) => {
  // Only process updates
  if (operation !== 'update' || !originalDoc) {
    return data
  }

  // Check if companies array has changed
  const previousCompanies = Array.isArray(originalDoc.companies) ? originalDoc.companies : []
  const currentCompanies = Array.isArray(data.companies) ? data.companies : []

  // Compare companies arrays by length and content
  const companiesChanged =
    previousCompanies.length !== currentCompanies.length ||
    JSON.stringify(previousCompanies.sort()) !== JSON.stringify(currentCompanies.sort())

  if (companiesChanged) {
    try {
      await updateMeetingVoteStatuses(data as Meeting)
    } catch (error) {
      req.payload.logger.error(
        `Error updating vote statuses after companies change for meeting ${data.id}:`,
        error,
      )
      // Don't throw error to avoid breaking the meeting save operation
    }
  }

  return data
}

/**
 * Update the vote status indicators for a meeting based on current counts
 * This is a copy of the function from the votes collection to avoid circular dependencies
 */
async function updateMeetingVoteStatuses(meeting: Meeting): Promise<void> {
  // Get the latest companies count directly from the meeting object
  const companiesCount = Array.isArray(meeting.companies) ? meeting.companies.length : 0

  // For votes count and reported votes count, we'll use the values from the meeting object
  // but ensure they're properly converted to numbers and defaulted to 0 if undefined
  const votesCount = Number(meeting.votesCount) || 0
  const reportVotesCount = Number(meeting.reportVotesCount) || 0

  // Calculate vote statuses using the utility function
  const { votesStatus, votesReportStatus } = calculateVoteStatuses(
    votesCount,
    reportVotesCount,
    companiesCount,
  )

  // Update the meeting object with the calculated statuses
  meeting.votesStatus = votesStatus
  meeting.votesReportStatus = votesReportStatus
}
