'use client'

import { useFormFields } from '@payloadcms/ui'
import { useDocumentInfo } from '@payloadcms/ui'
import { useMemo } from 'react'

export const ActivityStatsField = (props: any) => {
  const { id } = useDocumentInfo()

  // Get form data directly from Payload's form fields - no need for API calls!
  const companiesField = useFormFields(([fields]) => fields.companies)
  const votesCountField = useFormFields(([fields]) => fields.votesCount)
  const reportVotesCountField = useFormFields(([fields]) => fields.reportVotesCount)

  // Calculate stats directly from Payload's form fields
  const stats = useMemo(() => {
    const companiesValue = companiesField?.value as any
    const totalCompanies = Array.isArray(companiesValue) ? companiesValue.length : 0
    const votesCount = (votesCountField?.value as number) || 0
    const reportVotesCount = (reportVotesCountField?.value as number) || 0

    return {
      totalCompanies,
      votedCompanies: votesCount,
      actualVotedCompanies: reportVotesCount,
    }
  }, [companiesField?.value, votesCountField?.value, reportVotesCountField?.value])

  if (!id) {
    return (
      <div className="p-4 text-center text-gray-500">
        יש לשמור את האסיפה תחילה כדי לראות את נתוני הפעילות
      </div>
    )
  }
  const { actualVotedCompanies, totalCompanies, votedCompanies } = stats
  const votesPercentage =
    totalCompanies > 0 ? Math.min((votedCompanies / totalCompanies) * 100, 100) : 0

  return (
    <div className="flex text-lg font-bold gap-[4rem]">
      {/* Step 1: Total Companies (Base) */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-500 rounded-full flex-shrink-0"></div>
        <span>חברות:</span>
        <div className="flex gap-1">
          <span className="text-right w-5">{totalCompanies}</span>
          <span className="text-right w-10">(100%)</span>
        </div>
      </div>

      {/* Step 2: Companies that Voted */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></div>
        <span>הצבעות:</span>
        <div className="flex gap-1">
          <span className="text-right w-5">{votedCompanies}</span>
          <span className="text-right w-10">({Math.round(votesPercentage)}%)</span>
        </div>
      </div>

      {/* Step 3: Votes that were Reported */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-green-600 rounded-full flex-shrink-0"></div>
        <span>בפועל:</span>
        <div className="flex gap-1">
          <span className="text-right w-5">{actualVotedCompanies}</span>
          <span className="text-right w-10">
            ({votedCompanies > 0 ? Math.round((actualVotedCompanies / votedCompanies) * 100) : 0}
            %)
          </span>
        </div>
      </div>

      {/* Tooltip arrow */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
    </div>
  )
}

export default ActivityStatsField
