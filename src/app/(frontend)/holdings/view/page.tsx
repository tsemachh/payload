'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/providers/auth-provider'
import { DataTableStatic as DataTable } from '../../components/data-table-client'
import { columns } from './columns'
import { ExportButton } from '@/components/export-button'
import { DateSelector } from '../components/DateSelector'
import { stringify } from 'qs-esm'
import type { Where } from 'payload'
import { useSearchParams } from 'next/navigation'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import useSWR from 'swr'
import { fetcher } from '../../helpers/utils-data-table'
import { getWithErrorHandling } from '../../helpers/fetch-helpers'
import { handleAndNotifyError } from '../../helpers/error-handler'

export default function HoldingsView() {
  const { user } = useAuth()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [processedHoldings, setProcessedHoldings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const searchParams = useSearchParams()
  const dateFormUrl = searchParams.get('date')

  const { data: recentData } = useSWR('/api/holdings/dates?month=true', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  const { data: fullData } = useSWR(recentData ? '/api/holdings/dates' : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const markedDates = useMemo(() => {
    const recent = recentData?.data ?? []
    const full = fullData?.data ?? []
    const combined = [...new Set([...recent, ...full])]
    return combined.map((d) => new Date(d))
  }, [recentData, fullData])

  // Fetch initial data when component mounts
  useEffect(() => {
    if (dateFormUrl) {
      try {
        const dateTmp = new Date(`${dateFormUrl}T00:00:00`)
        setDate(dateTmp)
        setError('')
      } catch (e) {
        setError('לצפייה בהחזקות יש לבחור תאריך,  הנתונים יוצגו בהתאם ליום הנבחר.')
      }
    } else {
      setError('לצפייה בהחזקות יש לבחור תאריך,  הנתונים יוצגו בהתאם ליום הנבחר.')
    }
  }, [dateFormUrl])

  useEffect(() => {
    if (date && user?.funds && user.funds.length > 0) {
      fetchHoldings()
    }
  }, [date, user])

  // Create an action to update the date
  const handleDateChangeAction = async (newDate: Date | undefined) => {
    setDate(newDate)
    setError('')
    setProcessedHoldings([]) // Clear previous data when date changes
  }

  const fetchHoldings = async () => {
    if (!date) {
      setError('תאריך לא נבחר.')
      setProcessedHoldings([])
      return
    }

    setIsLoading(true)
    setError('')

    try {
      let selectedCompanies: string[] = []
      if (user?.funds) {
        selectedCompanies = user?.funds.map((fund) => (typeof fund === 'string' ? fund : fund.id))
      }
      if (selectedCompanies.length === 0) {
        setError('לא נמצאו חברות.')
        setProcessedHoldings([])
        return
      }

      const formattedDate = date.toISOString()
      const query: Where = {
        and: [
          {
            valueDate: {
              equals: formattedDate,
            },
          },
          {
            fund: {
              in: selectedCompanies,
            },
          },
        ],
      }

      const stringifiedQuery = stringify(
        {
          where: query,
          limit: 0,
          select: {
            fund: true,
            holdings: {
              stock: true,
              fund: true,
              quantity: true,
            },
          },
          depth: 1, // Need to get stock details
        },
        { addQueryPrefix: true },
      )

      const response = await getWithErrorHandling(`/api/holdings${stringifiedQuery}`, {
        errorMessage: 'שגיאה בטעינת הנתונים',
        notifyOnError: true,
      })

      const data = response as any // Assuming JSON response

      if (!data.docs || data.docs.length === 0) {
        setError('לא נמצאו נתונים עבור הבחירה הנוכחית.')
        setProcessedHoldings([])
        return
      }

      // Process the holding days data for display
      const processed = []
      for (const holdingDay of data.docs) {
        const fundName = holdingDay.fund?.name || 'N/A'
        const accountId = holdingDay.fund.mainAccount[0].accountNumber
        // Process each holding item in the holdings array
        if (holdingDay.holdings && Array.isArray(holdingDay.holdings)) {
          for (const item of holdingDay.holdings) {
            processed.push({
              id: `${holdingDay.id}-${item.stock?.id || 'unknown'}`,
              stockId: item.stock?.stockId || item.feedStockNum || 'N/A',
              stockName: item.stock?.name || 'N/A',
              quantity: item.quantity || 'N/A',
              company: fundName,
              accountId: accountId,
            })
          }
        }
      }

      setProcessedHoldings(processed)
      setError('')
    } catch (error) {
      setProcessedHoldings([]) // Clear data on error
      handleAndNotifyError(error, 'שגיאה בטעינת הנתונים')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 px-4 pt-1">
      <div className="h-[400px] mt-3 mb-6 md:mb-0">
        <div>
          <label className="text-base font-semibold mb-2 block h-100 text-center">תאריך ערך</label>
          <DateSelector
            date={date}
            isDateAlwaysOpen={true}
            onDateChangeAction={handleDateChangeAction}
            className="w-full"
            filterDate={(date) => {
              return !markedDates.some((markedDate) => {
                return markedDate.toDateString() === date.toDateString()
              })
            }}
          />
        </div>
      </div>

      <div className="hidden md:block w-[2px] bg-muted self-stretch mx-2" />

      <div className="w-full flex justify-center mt-3">
        {isLoading ? (
          <div className="flex flex-col h-[500px] items-center pt-[100px]">
            <LoadingSpinnerDiamond />
          </div>
        ) : (
          processedHoldings.length > 0 &&
          date && (
            <div>
              <h4 className="text-xl text-center pb-3">
                החזקות לתאריך {format(date, 'dd/MM/yyyy')}
              </h4>
              <DataTable
                columns={columns}
                data={processedHoldings}
                idField="id"
                defaultSortField="lastUpdated"
                defaultSortDirection="asc"
                tableId="holdings-view-table"
                columnsOption={false}
                tableHeightOffset={280}
              />
              <div className="flex justify-center mt-4">
                {processedHoldings.length > 0 && (
                  <ExportButton
                    data={processedHoldings}
                    filename={`holdings-${date ? format(date, 'yyyy-MM-dd') : 'export'}`}
                  />
                )}
              </div>
            </div>
          )
        )}
        {error !== '' && <h4 className="text-xl text-center pt-20">{error}</h4>}
      </div>
    </div>
  )
}