'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/providers/auth-provider'
import { useCompaniesContext } from '../../context/companiesContext'
import { DataTableStatic as DataTable } from '../../components/data-table-client'
import { columns } from './columns'
import { ExportButton } from '@/components/export-button'
import { DateSelector } from '../components/DateSelector'
import { CompaniesList } from '../components/companies-list'
import { stringify } from 'qs-esm'
import type { Where } from 'payload'
import { useSearchParams } from 'next/navigation'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import useSWR from 'swr'
import { fetcher } from '../../helpers/utils-data-table'
import { getWithErrorHandling } from '../../helpers/fetch-helpers'
import { handleAndNotifyError } from '../../helpers/error-handler'

interface DateRecord {
  date: string
  recordCount: number
}

interface Company {
  id: string
  name: string
  currentRecordCount: number
  dateRecords: DateRecord[]
}

export default function HoldingsView() {
  const { user } = useAuth()
  const { companies: contextCompanies } = useCompaniesContext()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [processedHoldings, setProcessedHoldings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [companies, setCompanies] = useState<Company[]>([])

  // Create a map for quick company lookup by ID
  const companyMap = useMemo(() => {
    const map = new Map<string, string>()
    contextCompanies.forEach((company) => {
      map.set(company.id, company.name)
    })
    return map
  }, [contextCompanies])

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

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
            company: true,
            stats: true,
            holdings: {
              stock: true,
              fund: true,
              quantity: true,
            },
          },
          depth: 1,
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
      const companiesMap = new Map<string, { id: string; name: string; recordCount: number }>()

      for (const holdingDay of data.docs) {
        const fundName = holdingDay.fund?.name || 'N/A'
        const accountId = holdingDay.fund.mainAccount[0].accountNumber
        const companyId =
          typeof holdingDay.company === 'string' ? holdingDay.company : holdingDay.company?.id
        const recordCount = holdingDay.stats?.recordCount || 0

        // Aggregate by parent company
        if (companyId) {
          const companyName = companyMap.get(companyId) || 'Unknown'

          if (!companiesMap.has(companyId)) {
            companiesMap.set(companyId, {
              id: companyId,
              name: companyName,
              recordCount: 0,
            })
          }
          const companyData = companiesMap.get(companyId)!
          companyData.recordCount += recordCount
        }

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

      // Convert companies map to array and sort by name
      const companiesArray = Array.from(companiesMap.values())
        .map((company) => ({
          id: company.id,
          name: company.name,
          currentRecordCount: company.recordCount,
          dateRecords: [], // Will be loaded on demand
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      setCompanies(companiesArray)
      setError('')
    } catch (error) {
      setProcessedHoldings([]) // Clear data on error
      handleAndNotifyError(error, 'שגיאה בטעינת הנתונים')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 px-4 pt-1 h-full">
      <div className="mt-3 min-w-[30%] mb-6 md:mb-0 space-y-6">
        <div className="flex flex-col items-center">
          <label className="text-base font-semibold mb-2 block h-100 text-center">תאריך ערך</label>
          <DateSelector
            date={date}
            isDateAlwaysOpen={true}
            onDateChangeAction={handleDateChangeAction}
            filterDate={(date) => {
              return !markedDates.some((markedDate) => {
                return markedDate.toDateString() === date.toDateString()
              })
            }}
          />
        </div>

        <div>
          {!date ? (
            <div className="text-center text-muted-foreground text-sm">בחר תאריך</div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <LoadingSpinnerDiamond />
            </div>
          ) : companies.length > 0 ? (
            <CompaniesList companies={companies} selectedDate={date} />
          ) : (
            <div className="text-center text-muted-foreground text-sm">אין נתונים</div>
          )}
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
                pagination={{
                  pageSize: 100,
                  currentPage: currentPage,
                  onPageChange: handlePageChange,
                }}
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
