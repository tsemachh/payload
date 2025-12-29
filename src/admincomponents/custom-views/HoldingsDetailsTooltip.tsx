'use client'

import { useState, useEffect } from 'react'
import { Info, X } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/(frontend)/components/ui/tooltip'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { format } from 'date-fns'

interface HoldingsDetail {
  valueDate: string
  quantity: number
}

interface HoldingsDetailsTooltipProps {
  fundId: string
  stockId: string
  holdingDate: string
}

export function HoldingsDetailsTooltip({
  fundId,
  stockId,
  holdingDate,
}: HoldingsDetailsTooltipProps) {
  const [holdings, setHoldings] = useState<HoldingsDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const fetchHoldingsDetails = async () => {
    if (holdings.length > 0) return // Already fetched

    setLoading(true)
    setError(null)

    try {
      const url = `/api/holdings/details?fundId=${fundId}&stockId=${stockId}&holdingLimitDate=${holdingDate}`
      console.log('@@@@Fetching holdings details:', { fundId, stockId, holdingDate, url })

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch holdings details')
      }

      const data = await response.json()
      console.log('@@@Holdings details response:', data)
      setHoldings(data.holdings || [])
    } catch (err) {
      console.error('Error fetching holdings details:', err)
      setError('שגיאה בטעינת נתונים')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && holdings.length === 0 && !loading && !error) {
      fetchHoldingsDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleClick = () => {
    setIsOpen((prev) => !prev)
  }

  return (
    <TooltipProvider delayDuration={Infinity} skipDelayDuration={Infinity}>
      <Tooltip open={isOpen}>
        <TooltipTrigger asChild>
          <button
            className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors ml-1"
            type="button"
            onClick={handleClick}
          >
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-3 max-w-xs"
        >
          <div className="space-y-2" dir="rtl">
            <div className="font-semibold text-center text-gray-900 dark:text-white text-sm border-b border-gray-200 dark:border-gray-700 pb-1 flex items-center gap-4">
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                type="button"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
              <span>פירוט החזקות</span>
            </div>
            {loading && (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400" />
              </div>
            )}
            {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {!loading && !error && holdings.length === 0 && (
              <div className="text-gray-500 dark:text-gray-400 text-sm">אין נתונים זמינים</div>
            )}
            {!loading && !error && holdings.length > 0 && (
              <div className="space-y-1">
                {holdings.map((holding, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center gap-4 text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <span className="text-gray-700 dark:text-gray-300">
                      {format(new Date(holding.valueDate), 'dd/MM/yyyy')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatNumberWithLocale(holding.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
