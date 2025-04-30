'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useAuth } from '@/providers/auth-provider'
import { DataTableStatic as DataTable } from '../../components/data-table-client'
import { columns } from './columns'
import { Holding } from '../types'
import { ExportButton } from '@/components/export-button'
import { DateSelector } from '../components/DateSelector'
import { stringify } from 'qs-esm'
import type { Where } from 'payload'
import { useSearchParams } from 'next/navigation'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'

export default function HoldingsView() {
  const { user } = useAuth()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const searchParams = useSearchParams()
  const encoded = searchParams.get('data')

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
  }, [])

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
          company: {
            in: selectedCompanies,
          },
        },
      ],
    }

    const stringifiedQuery = stringify(
      {
        where: query,
        limit: 0,
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
      if (user?.leafCompanies) {
        selectedCompanies = user?.leafCompanies.map((company) =>
          typeof company === 'string' ? company : company.id,
        )
      }
      if (selectedCompanies.length === 0) {
        setError('לא נמצאו חברות.')
        return
      }
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await getHoldingsFromAPI(formattedDate, selectedCompanies)
      const data = await response.json()

      if (response.ok) {
        if (!data.docs.length) {
          setError('לא נמצאו נתונים עבור הבחירה הנוכחית. ')
        } else {
          setError('')
        }
        setHoldings(
          data.docs.map((holding: any) => ({
            id: holding.id,
            stockId: holding.stock?.stockId || 'N/A',
            stockName: holding.stock?.name || 'N/A',
            quantity: holding.quantity || 'N/A',
            company: holding.company?.name || 'N/A',
          })),
        )
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
            isDateAlwaysOpen={true}
            onDateChangeAction={handleDateChangeAction}
            className="w-full"
            filterDate={(date) => {
              const now = new Date()
              now.setHours(0, 0, 0, 0)
              const day = date.getDay()
              return day == 5 || day == 6 || date > now
            }}
          />
        </div>
      </div>
      <div className="hidden md:block w-[2px] bg-muted self-stretch mx-2" />
      <div className="w-full flex justify-center mt-3">
        {isLoading ? (
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
            <p className="text-center">מייבא נתונים...</p>
          </div>
        ) : (
          holdings.length > 0 &&
          date && (
            <div>
              <h4 className="text-xl text-center pb-3">
                אחזקות לתאריך {format(date, 'dd/MM/yyyy')}
              </h4>
              <DataTable
                columns={columns}
                data={holdings}
                idField="id"
                defaultSortField="lastUpdated"
                defaultSortDirection="desc"
                tableId="holdings-view-table"
                columnsOption={false}
                tableHeightOffset={280}
              />
              <div className="flex justify-center mt-4">
                {holdings.length > 0 && (
                  <ExportButton
                    data={holdings}
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
