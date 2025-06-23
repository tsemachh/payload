'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Props for the ParticipationReportStatusCell component
 * @typedef {Object} ParticipationReportStatusCellProps
 * @property {string} [cellData] - The cell data passed in table view (e.g., ID of uploaded file or undefined)
 */
export type ParticipationReportStatusCellProps = DefaultCellComponentProps

/**
 * Cell component for displaying participation report status in PayloadCMS tables
 * Displays an icon (❌ or ✅) based on whether a participation report exists, with a tooltip showing the status
 * @param {ParticipationReportStatusCellProps} props - Component props
 * @returns React component
 */
const ParticipationReportStatusCell: React.FC<ParticipationReportStatusCellProps> = ({
  cellData,
}) => {
  // Determine status and tooltip based on cellData
  const hasReport = !!cellData // Check if cellData exists (e.g., ID of uploaded file)
  const statusIcon = hasReport ? '✅' : '❌'
  const tooltipText = hasReport ? 'דוח השתתפות מוכן' : 'דוח השתתפות לא מוכן'

  return (
    <span
      className="inline-flex items-center justify-center w-[26px] h-[26px] text-base cursor-pointer"
      title={tooltipText}
    >
      {statusIcon}
    </span>
  )
}

export default ParticipationReportStatusCell
