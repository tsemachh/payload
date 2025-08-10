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
): Promise<{
  success: boolean
  message: string
  data: {
    votesCount: number
    reportVotesCount: number
    votesStatus: VotesStatus
    votesReportStatus: VotesReportStatus
  }
}> {
  try {
    // Get the meeting
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      select: {
        votes: true,
        companies: true,
      },
      id: meetingId,
      depth: 1,
    })

    if (!meeting) {
      throw new Error(`Meeting with ID ${meetingId} not found`)
    }

    // Count reported votes
    const reportVotesCount =
      meeting?.votes?.docs?.filter((vote) => (vote as Vote).reported === true).length || 0
    // Calculate status indicators
    const companiesCount = meeting.companies?.length || 0
    //vote Count
    const votesCount = meeting?.votes?.docs?.length || 0
    // Calculate vote statuses using the utility function
    const { votesStatus, votesReportStatus } = calculateVoteStatuses(
      votesCount,
      reportVotesCount,
      companiesCount,
    )

    // Update the meeting with calculated values
    await req.payload.update({
      collection: 'meetings',
      id: meetingId,
      data: {
        votesCount,
        reportVotesCount,
        votesStatus,
        votesReportStatus,
      },
      depth: 0,
      req: {
        ...req,
        context: { ...req.context, from: 'migration' },
      },
    })

    return {
      success: true,
      message: `Updated meeting ${meetingId}: votes=${votesCount}, reported=${reportVotesCount}`,
      data: {
        votesCount,
        reportVotesCount,
        votesStatus,
        votesReportStatus,
      },
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
  const votesCount = Number(meeting.votesCount) || 0
  const reportVotesCount = Number(meeting.reportVotesCount) || 0
  const companiesCount = Array.isArray(meeting.companies) ? meeting.companies.length : 0

  // Calculate vote statuses using the utility function
  const { votesStatus, votesReportStatus } = calculateVoteStatuses(
    votesCount,
    reportVotesCount,
    companiesCount,
  )

  meeting.votesStatus = votesStatus
  meeting.votesReportStatus = votesReportStatus
}
