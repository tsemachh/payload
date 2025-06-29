'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Props for the ReportedVotesStatusCell component
 * @typedef {Object} ReportedVotesStatusCellProps
 * @property {string} [cellData] - The cell data passed in table view (e.g., "3/3")
 */
export type ReportedVotesStatusCellProps = DefaultCellComponentProps

/**
 * Cell component for displaying reported votes status in PayloadCMS tables
 * Displays an icon (❌, ❗, or ✅) based on reported votes count, with a tooltip showing the count and status
 * @param {ReportedVotesStatusCellProps} props - Component props
 * @returns React component
 */
const ReportedVotesStatusCell: React.FC<ReportedVotesStatusCellProps> = ({ cellData }) => {
  // Log cellData for debugging

  // Initialize variables
  let reportedVotes = 0
  let totalVotes = 0
  let isValid = false
  let displayData = '0/0'

  // Parse cellData if it's a valid string
  if (typeof cellData === 'string' && cellData.includes('/')) {
    const [parsedReported, parsedTotal] = cellData.split('/').map(Number)
    if (!isNaN(parsedReported) && !isNaN(parsedTotal)) {
      reportedVotes = parsedReported
      totalVotes = parsedTotal
      isValid = true
      displayData = cellData
    }
  } else {
    console.warn('Invalid cellData format:', cellData)
  }

  let statusIcon = ''

  if (isValid) {
    if (reportedVotes === 0) {
      statusIcon = '❌'
    } else if (reportedVotes < totalVotes) {
      statusIcon = '❗'
    } else if (reportedVotes === totalVotes && totalVotes > 0) {
      statusIcon = '✅'
    }
  }

  const tooltipText = isValid
    ? `${reportedVotes} חברות דווחו לרשות מתוך ${totalVotes} שהצביעו`
    : 'דיווחים: אין נתונים'
  return (
    <span
      className="inline-flex items-center justify-center w-[26px] h-[26px] text-base cursor-pointer"
      title={tooltipText}
    >
      {statusIcon || '—'}
    </span>
  )
}

export default ReportedVotesStatusCell
