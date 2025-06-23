'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Props for the VotingCountsStatusCell component
 * @typedef {Object} VotingCountsStatusCellProps
 * @property {string} [cellData] - The cell data passed in table view (e.g., "3/12")
 */
export type VotingCountsStatusCellProps = DefaultCellComponentProps

/**
 * Cell component for displaying vote status icon in PayloadCMS tables
 * Displays an icon (❌, ❗, or ✅) based on vote count, with a tooltip showing the vote count (e.g., 3/12)
 * @param {VotingCountsStatusCellProps} props - Component props
 * @returns React component
 */
const VotingCountsStatusCell: React.FC<VotingCountsStatusCellProps> = ({ cellData }) => {
  // Parse the cellData into votes and companies
  const [votes, companies] = cellData ? cellData.split('/').map(Number) : [0, 0]

  let statusIcon = ''

  if (cellData) {
    if (votes === 0) {
      statusIcon = '❌'
    } else if (votes < companies) {
      statusIcon = '❗'
    } else if (votes === companies && companies > 0) {
      statusIcon = '✅'
    }
  }
  const tooltipText = cellData
    ? `${votes} חברות שהצביעו מתוך ${companies} שזומנו לאסיפה`
    : 'אין נתונים'
  return (
    <span
      className="inline-flex items-center justify-center w-[26px] h-[26px] text-base cursor-pointer"
      title={tooltipText}
    >
      {statusIcon || '—'}
    </span>
  )
}

export default VotingCountsStatusCell
