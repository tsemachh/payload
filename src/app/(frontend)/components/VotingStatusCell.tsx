'use client'
import { useCompaniesContext } from '../context/companiesContext'
import { VoteStatusIcon } from '@/components/ui/icons'
import { MeetingTableDataType } from '../types/meetings'

export function VotingStatusCell({ row }: { row: MeetingTableDataType }) {
  const { companies } = useCompaniesContext()

  const userCompanyIds = companies.map((c) => c.id)

  const userVotes = Array.isArray(row.votes?.docs)
    ? row.votes.docs.filter((v: any) => userCompanyIds.includes(v.company))
    : []

  const allReported = userVotes.length > 0 && userVotes.every((v: any) => v.reported === true)
  const someReported = userVotes.some((v: any) => v.reported === true)

  if (allReported) return <VoteStatusIcon value="all" />
  if (someReported) return <VoteStatusIcon value="some" />
  return <VoteStatusIcon value="none" />
}
