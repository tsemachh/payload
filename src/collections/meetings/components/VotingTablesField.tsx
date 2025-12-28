'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { memo } from 'react'
import { useVotingData } from '../hooks/useVotingData'
import ManageMeetingCompanies from './ManageMeetingCompanies'
import { getGroupedVotesUrl } from '../../../utils/voteGrouping'
import NotVotedCompaniesTable from './NotVotedCompaniesTable'
import VotedCompaniesTable from './VotedCompaniesTable'
import HistoricalHoldingsTable from './HistoricalHoldingsTable'

const MemoizedNotVotedCompaniesTable = memo(NotVotedCompaniesTable)
const MemoizedVotedCompaniesTable = memo(VotedCompaniesTable)
const MemoizedHistoricalHoldingsTable = memo(HistoricalHoldingsTable)
const MemoizedManageMeetingCompanies = memo(ManageMeetingCompanies)

export const VotingTablesField = () => {
  const { id } = useDocumentInfo()
  const {
    notVotedCompanies,
    votedCompanies,
    processedNotVotedData,
    processedVotedData,
    historicalHoldings,
    votedLoading,
    notVotedLoading,
    historicalLoading,
    exportToCSV,
    groupByNotVoted,
    setGroupByNotVoted,
    groupByVoted,
    setGroupByVoted,
    toggleNotVotedGroup,
    toggleVotedGroup,
    notVotedSort,
    votedSort,
    handleNotVotedSort,
    handleVotedSort,
  } = useVotingData()

  // Generate grouped vote URL for href
  const getGroupedVoteUrl = (item: any) => {
    if (!id) {
      console.error('meetingId is missing can not create votes url without meetingId')
      return
    }
    // Use parentCompanyId if available, otherwise fall back to company's own ID
    const parentCompanyId = item.parentCompanyId || item.id
    const checksum = item.vote?.checksum
    return getGroupedVotesUrl(id, parentCompanyId, checksum)
  }

  if (!id) {
    return (
      <div className="p-4 text-center text-gray-500">
        יש לשמור את האסיפה תחילה כדי לראות את ממשק ההצבעות
      </div>
    )
  }

  return (
    <div className="useTw space-y-6 p-6 text-base" dir="rtl">
      <MemoizedNotVotedCompaniesTable
        data={processedNotVotedData}
        loading={notVotedLoading}
        groupBy={groupByNotVoted}
        setGroupBy={setGroupByNotVoted}
        toggleGroup={toggleNotVotedGroup}
        sort={notVotedSort}
        handleSort={handleNotVotedSort}
        exportToCSV={exportToCSV}
        companyCount={notVotedCompanies.length}
      />

      <MemoizedVotedCompaniesTable
        data={processedVotedData}
        loading={votedLoading}
        groupBy={groupByVoted}
        setGroupBy={setGroupByVoted}
        toggleGroup={toggleVotedGroup}
        sort={votedSort}
        handleSort={handleVotedSort}
        exportToCSV={exportToCSV}
        companyCount={votedCompanies.length}
        getGroupedVoteUrl={getGroupedVoteUrl}
      />

      <MemoizedHistoricalHoldingsTable data={historicalHoldings} loading={historicalLoading} />

      <MemoizedManageMeetingCompanies />
    </div>
  )
}

export default VotingTablesField
