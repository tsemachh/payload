import { MeetingTableDataType } from "../types/meetings"

// Helper function to get user votes for a meeting (filtered by user's companies)
const getUserVotesForMeeting = (row: MeetingTableDataType, userCompanyIdsInMeeting: string[]) => {
  if (!Array.isArray(row.votes?.docs) || userCompanyIdsInMeeting.length === 0) {
    return []
  }

  return row.votes.docs.filter((v: any) => {
    if (typeof v === 'string') {
      return false
    }
    return userCompanyIdsInMeeting.includes(v.company)
  })
}

// Helper function to check if user has reported votes for all their companies in a meeting
export const hasUserReportedAllVotes = (
  row: MeetingTableDataType,
  userCompanyIdsInMeeting: string[],
): boolean => {
  const userVotes = getUserVotesForMeeting(row, userCompanyIdsInMeeting)
  const reportedCount = userVotes.filter((v: any) => v.reported === true).length
  const allReported = reportedCount > 0 && reportedCount == row.companies.length

  return allReported
}

// Helper function to check if user has any reported votes for a meeting
export const hasUserAnyReportedVotes = (
  row: MeetingTableDataType,
  userCompanyIdsInMeeting: string[],
): boolean => {
  const userVotes = getUserVotesForMeeting(row, userCompanyIdsInMeeting)
  return userVotes.some((v: any) => v.reported === true)
}
