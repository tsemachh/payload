'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/providers/auth-provider'
import { DataTableStatic as DataTable } from '../../components/data-table-client'
import { columns } from './columns'
import { Holding } from '../types'
import { ExportButton } from '@/components/export-button'
import { transformCompaniesToTree } from '../../helpers/utils-holdings'
import { CompanyTreeSelector, TreeNode } from '../components/CompanySelector'
import { DateSelector } from '../components/DateSelector'
import { stringify } from 'qs-esm'
import type { Where } from 'payload'
import { useSearchParams } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import { AlertTriangle } from 'lucide-react'

export default function HoldingsView() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<TreeNode[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [date, setDate] = useState<Date | undefined>()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState('')

  const searchParams = useSearchParams()
  const encoded = searchParams.get('data')

  // Fetch initial data when component mounts
  useEffect(() => {
    if (encoded) {
      try {
        const decoded = JSON.parse(atob(encoded))
        setDate(decoded.date)
        setSelectedCompanies(decoded.selectedCompanies)
      } catch (e) {
        console.error('Invalid data', e)
      }
    }
  }, [])

  useEffect(() => {
    if (date && selectedCompanies.length > 0) {
      fetchHoldings()
    }
  }, [date, selectedCompanies])

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

  // Extract companies from user
  useEffect(() => {
    if (user?.companies) {
      // Transform the flat company structure into a hierarchical tree
      const transformedCompanies = transformCompaniesToTree(user.companies)
      setCompanies(transformedCompanies)
    }
    if (user?.leafCompanies && selectedCompanies.length == 0) {
      const tmpSelectedCompanies = user?.leafCompanies.map((company) =>
        typeof company === 'string' ? company : company.id,
      )
      setSelectedCompanies(tmpSelectedCompanies)
    }
  }, [user])

  const fetchHoldings = async () => {
    if (!date) {
      setIsError('תאריך לא נבחר.')
      return
    }

    if (selectedCompanies.length === 0) {
      setIsError('חברות לא נבחרו.')
      return
    }
    setIsLoading(true)

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await getHoldingsFromAPI(formattedDate, selectedCompanies)
      const data = await response.json()

      if (response.ok) {
        if (!data.docs.length) setIsError('לא נמצאו נתונים עבור הבחירה הנוכחית. ')
        setHoldings(
          data.docs.map((holding: any) => ({
            id: holding.id,
            stockNumber: holding.stock?.stockId || 'N/A',
            stockName: holding.stock?.name || 'N/A',
            quantity: holding.quantity || 'N/A',
            company: holding.company?.name || 'N/A',
          })),
        )
      } else {
        setIsError('שגיאת נתונים.')
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      setIsError('שגיאה בטעינת הנתונים.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className=" flex flex-col md:flex-row gap-6 px-4 pt-1">
      <div className="w-full md:flex-[1]">
        <div>
          <label className="text-base font-semibold mb-2 block h-100">תאריך ערך</label>
          <DateSelector
            date={date}
            isDateAlwaysOpen={true}
            onDateChange={setDate}
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
      <div className="hidden md:block w-px bg-muteda" />
      <div className="w-full md:flex-[3]">
        {}
        {isLoading ? (
          <div className="flex flex-col h-[500px] items-center pt-[100px] ">
            <LoadingSpinnerDiamond />
            <p className="text-center">מייבא נתונים...</p>
          </div>
        ) : (
          holdings.length > 0 &&
          date && (
            <div>
              <h4 className="text-xl text-center">אחזקות לתאריך {format(date, 'dd/MM/yyyy')}</h4>
              <DataTable
                columns={columns}
                data={holdings}
                idField="id"
                defaultSortField="lastUpdated"
                defaultSortDirection="desc"
                tableId="holdings-view-table"
                columnsOption={false}
                tableHeightOffset={250}
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
        <Dialog open={isError != ''}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader className="flex flex-row items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <DialogTitle className="text-xl text-red-600 m-0">אין נתונים</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <p className="text-base font-medium">{isError}</p>
            </div>
            <DialogFooter className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => {
                  setIsError('')
                  setDate(undefined)
                }}
              >
                חזרה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
