'use client'

import { useState } from 'react'

interface CompactMeetingBarProps {
  companies: number
  votes: number
  reportedVotes: number
}

export default function CompactMeetingBar({
  companies,
  votes,
  reportedVotes,
}: CompactMeetingBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  // Update the percentage calculations to ensure proper constraints
  const votesPercentage = companies > 0 ? Math.min((votes / companies) * 100, 100) : 0
  const reportedPercentage =
    companies > 0 ? Math.min((reportedVotes / companies) * 100, votesPercentage) : 0

  return (
    <div className="relative w-full min-w-[150px] ">
      <div
        className="relative h-6 bg-gray-500 rounded-full overflow-hidden cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Votes bar (base layer) */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${votesPercentage}%` }}
        />

        {/* Reported votes bar (overlay) */}
        <div
          className="absolute top-0 left-0 h-full bg-green-600 transition-all duration-300"
          style={{ width: `${reportedPercentage}%` }}
        />

        {/* Text overlay - showing all 3 numbers */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {reportedVotes}/{votes}/{companies}
          </span>
        </div>
      </div>

      {/* Tooltip - Compact Aligned Format */}
      {showTooltip && (
        <div className="absolute bottom-full mb-2 z-10 left-1/2 transform -translate-x-1/2">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 shadow-lg">
            <div className="space-y-0.5">
              {/* Step 1: Total Companies (Base) */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0"></div>
                <div className="flex justify-between w-full min-w-[120px]">
                  <span>חברות:</span>
                  <div className="flex gap-1">
                    <span className="text-right w-5">{companies}</span>
                    <span className="text-right w-10">(100%)</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Companies that Voted */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <div className="flex justify-between w-full min-w-[120px]">
                  <span>הצבעות:</span>
                  <div className="flex gap-1">
                    <span className="text-right w-5">{votes}</span>
                    <span className="text-right w-10">({Math.round(votesPercentage)}%)</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Votes that were Reported */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full flex-shrink-0"></div>
                <div className="flex justify-between w-full min-w-[120px]">
                  <span>דווח:</span>
                  <div className="flex gap-1">
                    <span className="text-right w-5">{reportedVotes}</span>
                    <span className="text-right w-10">
                      ({votes > 0 ? Math.round((reportedVotes / votes) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  )
}
