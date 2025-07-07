'use client'
import React from 'react'
import { useField } from '@payloadcms/ui'

/**
 * Props for the VotingCountsStatus component
 * @typedef {Object} VotingCountsStatusProps
 * @property {string} path - The path to the field in the Payload form
 */
export type VotingCountsStatusProps = {
  path: string
}

/**
 * Field component for displaying vote count and status in PayloadCMS forms
 * Displays the vote count (e.g., 3/12) and status (Empty, Partial, Complete) with icons
 * @param {VotingCountsStatusProps} props - Component props
 * @returns React component
 */
const VotingCountsStatus: React.FC<VotingCountsStatusProps> = ({ path }) => {
  // Get the field value (e.g., "3/12")
  const { value } = useField<string>({ path })

  // Parse the value into votes and companies
  const [votes, companies] = value ? value.split('/').map(Number) : [0, 0]

  let statusIcon = ''

  if (value) {
    if (votes === 0) {
      statusIcon = '❌'
    } else if (votes < companies) {
      statusIcon = '❗'
    } else if (votes === companies && companies > 0) {
      statusIcon = '✅'
    }
  }

  return (
    <div className="p-2 mb-2">
      <div className="inline-flex items-center gap-4 p-4 rounded-xl bg-gray-50 text-gray-800 shadow-sm">
        <span className="flex items-center gap-2 text-4xl font-semibold text-gray-800">
          {value || 'אין נתונים'}
        </span>

        {value && (
          <span className="flex items-center gap-2 text-4xl font-semibold text-gray-800">
            הצביעו
            <span className="text-4xl leading-none font-semibold text-gray-800">{statusIcon}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default VotingCountsStatus
