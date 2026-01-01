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
        companiesCount: number
        votesExceedCompanies: boolean
      }
    }
  | undefined
> {
  const isMigration = req.context?.from === 'migration'
  const logPrefix = `[recalculateMeetingVoteCounts][${meetingId}]`

  try {
    if (isMigration) console.log(`${logPrefix} Step 1: Fetching meeting...`)
    // Get the meeting with companies (IDs only)
    const meeting = await req.payload.findByID({
      collection: 'meetings',
      select: {
        migrationComments: true,
        companies: true,
        votesCount: true,
        reportVotesCount: true,
        votesStatus: true,
        votesReportStatus: true,
      },
      id: meetingId,
      depth: 0,
    })

    if (!meeting) {
      throw new Error(`Meeting with ID ${meetingId} not found`)
    }

    if (isMigration) console.log(`${logPrefix} Step 2: Counting published votes...`)
    // Count published votes using count() for performance
    const { totalDocs: newVotesCount } = await req.payload.count({
      collection: 'votes',
      where: {
        meeting: { equals: meetingId },
        _status: { equals: 'published' },
      },
      req,
    })

    if (isMigration) console.log(`${logPrefix} Step 3: Counting reported votes...`)
    // Count reported votes using count() for performance
    const { totalDocs: newReportVotesCount } = await req.payload.count({
      collection: 'votes',
      where: {
        meeting: { equals: meetingId },
        _status: { equals: 'published' },
        reported: { equals: true },
      },
      req,
    })

    if (isMigration) console.log(`${logPrefix} Step 4: Calculating statuses...`)
    // Calculate status indicators
    const companiesCount = meeting.companies?.length || 0
    // Calculate vote statuses using the utility function
    const { votesStatus, votesReportStatus } = calculateVoteStatuses(
      newVotesCount,
      newReportVotesCount,
      companiesCount,
    )
    const votesExceedCompanies = newVotesCount > companiesCount
    const data = {
      votesCount: newVotesCount,
      reportVotesCount: newReportVotesCount,
      votesStatus,
      votesReportStatus,
      companiesCount,
      votesExceedCompanies,
    }
    // Trigger update if counts changed OR computed statuses differ from stored ones
    const countsChanged =
      newReportVotesCount != meeting.reportVotesCount || newVotesCount != meeting.votesCount
    const statusesChanged =
      meeting.votesStatus !== votesStatus || meeting.votesReportStatus !== votesReportStatus

    if (countsChanged || statusesChanged) {
      if (isMigration) console.log(`${logPrefix} Step 5: Updating meeting counts/statuses...`)
      // Get current meeting to access its changeDetails
      const currentMeeting = meeting

      if (
        newVotesCount != currentMeeting.votesCount ||
        newReportVotesCount != currentMeeting.reportVotesCount ||
        currentMeeting.votesStatus !== votesStatus ||
        currentMeeting.votesReportStatus !== votesReportStatus
      ) {
        // Prepare change details
        const changeDate = new Date().toISOString()
        const changeSource = req.context?.from || 'system'
        const changeDescription = `עדכון מספר הצבעות: ${newVotesCount}, הצבעות מדווחות: ${newReportVotesCount}`
        const existingChangeDetails = currentMeeting?.migrationComments || ''
        const migrationComments = `${changeDate} - [${changeSource}] ${changeDescription}\n${existingChangeDetails}`

        // Update the meeting with calculated values
        await req.payload.update({
          collection: 'meetings',
          id: meetingId,
          data: {
            votesCount: newVotesCount,
            reportVotesCount: newReportVotesCount,
            votesStatus,
            votesReportStatus,
            migrationComments,
          },
          depth: 0,
          req: {
            ...req,
            context: {
              ...req.context,
              from: 'migration',
              process: 'recalculateMeetingVoteCounts',
            },
          },
        })

        return {
          success: true,
          message: `Updated meeting ${meetingId}: votes=${newVotesCount}, reported=${newReportVotesCount}`,
          data,
        }
      } else {
        return {
          success: true,
          message: `No Changes were made meeting ${meetingId}: votes=${newVotesCount}, reported=${newReportVotesCount}`,
          data,
        }
      }
    }

    // If counts are already up-to-date, still return a result with computed data
    return {
      success: true,
      message: `Counts up-to-date for meeting ${meetingId}: votes=${newVotesCount}, reported=${newReportVotesCount}`,
      data,
    }
  } catch (error: any) {
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

  // Skip if companies are not being updated to avoid false positives and incorrect status resets
  if (data.companies === undefined) {
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
      // Pass the source from the request context or default to 'system'
      const source = req.context?.from || 'system'
      await updateMeetingVoteStatuses(data as Meeting, source as string)
    } catch (error) {
      req.payload.logger.error(
        { error },
        `Error updating vote statuses after companies change for meeting ${data.id}:`,
      )
      // Don't throw error to avoid breaking the meeting save operation
    }
  }

  return data
}

/**
 * Update the vote status indicators for a meeting based on current counts
 * This is a copy of the function from the votes collection to avoid circular dependencies
 * @param meeting - The meeting object to update
 * @param source - The source of the change (e.g., 'user', 'system', 'migration')
 */
async function updateMeetingVoteStatuses(
  meeting: Meeting,
  source: string = 'system',
): Promise<void> {
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

  // Check if statuses have changed
  if (meeting.votesStatus !== votesStatus || meeting.votesReportStatus !== votesReportStatus) {
    // Update the meeting object with the calculated statuses
    meeting.votesStatus = votesStatus
    meeting.votesReportStatus = votesReportStatus

    // Update changeDetails field with status change information
    const changeDate = new Date().toISOString()
    const changeDescription = `עדכון סטטוס הצבעות: ${votesStatus}, סטטוס הצבעות מדווחות: ${votesReportStatus}`
    meeting.migrationComments = `${changeDate} - [${source}] ${changeDescription}`
  }
}
