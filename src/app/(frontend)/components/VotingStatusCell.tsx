'use client'
import { VoteStatusIcon } from '@/components/ui/icons'
import { MeetingTableDataType } from '../types/meetings'
import { hasUserReportedAllVotes, hasUserAnyReportedVotes } from '../helpers/utils-meeting'

export function VotingStatusCell({ row }: { row: MeetingTableDataType }) {
  const userCompanyIds = row.companies.map((c) => c.id)

  const allReported = hasUserReportedAllVotes(row, userCompanyIds)
  const someReported = hasUserAnyReportedVotes(row, userCompanyIds)

  if (allReported) return <VoteStatusIcon value="all" />
  if (someReported) return <VoteStatusIcon value="some" />
  return <VoteStatusIcon value="none" />
}
