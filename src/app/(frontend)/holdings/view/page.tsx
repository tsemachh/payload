'use client'

import { useState, useEffect, useMemo } from 'react'
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

export default function HoldingsView() {
  const { user } = useAuth()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [processedHoldings, setProcessedHoldings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const searchParams = useSearchParams()
  const encoded = searchParams.get('data')

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
    if (encoded) {
      try {
        const decoded = JSON.parse(atob(encoded))
        setDate(new Date(decoded.date))
        setError('')
      } catch (e) {
        setError('לצפייה באחזקות יש לבחור תאריך,  הנתונים יוצגו בהתאם ליום הנבחר.')
        console.error('Invalid data', e)
      }
    } else {
      setError('לצפייה באחזקות יש לבחור תאריך,  הנתונים יוצגו בהתאם ליום הנבחר.')
    }
  }, [encoded])

  useEffect(() => {
    if (date) {
      fetchHoldings()
    }
    if (!date) {
      setError('לצפייה באחזקות יש לבחור תאריך,  הנתונים יוצגו בהתאם ליום הנבחר.')
    }
  }, [date])

  const getHoldingsFromAPI = async (formattedDate: string, selectedCompanies: string[]) => {
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

    const response = await fetch(`/api/holdings${stringifiedQuery}`)
    return response
  }

  // Create an action to update the date
  const handleDateChangeAction = async (newDate: Date | undefined) => {
    setDate(newDate)
    setError('')
  }

  const fetchHoldings = async () => {
    if (!date) {
      setError('תאריך לא נבחר.')
      return
    }
    setIsLoading(true)

    try {
      let selectedCompanies: string[] = []
      if (user?.funds) {
        selectedCompanies = user?.funds.map((fund) => (typeof fund === 'string' ? fund : fund.id))
      }
      if (selectedCompanies.length === 0) {
        setError('לא נמצאו חברות.')
        return
      }
      const formattedDate = date.toISOString()
      const response = await getHoldingsFromAPI(formattedDate, selectedCompanies)
      const data = await response.json()

      if (response.ok) {
        if (!data.docs.length) {
          setError('לא נמצאו נתונים עבור הבחירה הנוכחית. ')
        } else {
          setError('')
        }

        // Process the holding days data for display
        const processed = []
        for (const holdingDay of data.docs) {
          const fundName = holdingDay.fund?.name || 'N/A'

          // Process each holding item in the holdings array
          if (holdingDay.holdings && Array.isArray(holdingDay.holdings)) {
            for (const item of holdingDay.holdings) {
              processed.push({
                id: `${holdingDay.id}-${item.stock?.id || 'unknown'}`,
                stockId: item.stock?.stockId || item.feedStockNum || 'N/A',
                stockName: item.stock?.name || 'N/A',
                quantity: item.quantity || 'N/A',
                company: fundName,
              })
            }
          }
        }

        setProcessedHoldings(processed)
      } else {
        setError('שגיאת נתונים.')
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      setError('שגיאה בטעינת הנתונים.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex md:flex-row gap-6 px-4 pt-1">
      <div className="h-[400px] mt-3 ">
        <div>
          <label className="text-base font-semibold mb-2 block h-100 text-center">תאריך ערך</label>
          <DateSelector
            date={date}
            // markedDates={markedDates}
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
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
          </div>
        ) : (
          processedHoldings.length > 0 &&
          date && (
            <div>
              <h4 className="text-xl text-center pb-3">
                אחזקות לתאריך {format(date, 'dd/MM/yyyy')}
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
        {error != '' && <h4 className="text-xl text-center pt-20">{error}</h4>}
      </div>
    </div>
  )
}
