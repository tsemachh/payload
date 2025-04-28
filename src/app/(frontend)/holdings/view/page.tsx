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
  const [editForm, setEditForm] = useState(true)

  const searchParams = useSearchParams()
  const encoded = searchParams.get('data')

  // Fetch initial data when component mounts
  useEffect(() => {
    if (encoded) {
      try {
        const decoded = JSON.parse(atob(encoded))
        setDate(decoded.date)
        setSelectedCompanies(decoded.selectedCompanies)
        setEditForm(false)
      } catch (e) {
        console.error('Invalid data', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!editForm && selectedCompanies.length > 0) {
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
      toast({
        title: 'שגיאה',
        description: 'נא לבחור תאריך',
        variant: 'destructive',
      })
      return
    }

    if (selectedCompanies.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'נא לבחור לפחות חברה אחת',
        variant: 'destructive',
      })
      return
    }
    setEditForm(false)
    setIsLoading(true)

    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const response = await getHoldingsFromAPI(formattedDate, selectedCompanies)
      const data = await response.json()

      if (response.ok) {
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
        toast({
          title: 'שגיאה בטעינת נתונים',
          description: data.error || 'אירעה שגיאה בטעינת הנתונים',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching holdings:', error)
      toast({
        title: 'שגיאה בטעינת נתונים',
        description: 'אירעה שגיאה בטעינת הנתונים',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {editForm ? (
        <>
          <div className="flex flex-col gap-6 px-4 pt-10 md:flex-row md:justify-center md:gap-6 md:px-10">
            <div>
              <label className="text-base font-semibold mb-2 block">חברות</label>
              <CompanyTreeSelector
                companies={companies}
                selectedCompanies={selectedCompanies}
                onSelectionChange={setSelectedCompanies}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-base font-semibold mb-2 block">תאריך ערך</label>
              <DateSelector
                date={date}
                onDateChange={setDate}
                className="w-full"
                filterDate={(date) => {
                  const day = date.getDay()
                  return day == 5 || day == 6
                }}
              />
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              variant={
                !date || selectedCompanies.length === 0 || isLoading ? 'default' : 'defaultHover'
              }
              onClick={
                !date || selectedCompanies.length === 0 || isLoading ? () => {} : fetchHoldings
              }
              className="px-40"
              style={
                !date || selectedCompanies.length === 0 || isLoading
                  ? { cursor: 'not-allowed', opacity: 0.5 }
                  : {}
              }
            >
              {isLoading ? 'טוען...' : 'טען אחזקות'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {date && (
            <h4 className="text-xl text-center">אחזקות לתאריך {format(date, 'dd/MM/yyyy')}</h4>
          )}

          {holdings.length > 0 ? (
            <div>
              <DataTable
                columns={columns}
                data={holdings}
                idField="id"
                defaultSortField="lastUpdated"
                defaultSortDirection="desc"
                tableId="holdings-view-table"
                filterOption={false}
              />
              <div className="flex justify-end gap-3 mt-6 ml-[8%] rtl">
                <div className="flex items-center space-x-4 space-x-reverse">
                  {holdings.length > 0 && (
                    <ExportButton
                      data={holdings}
                      filename={`holdings-${date ? format(date, 'yyyy-MM-dd') : 'export'}`}
                    />
                  )}
                  <Button onClick={() => setEditForm(true)}>חזרה לעריכת חברות ותאריך</Button>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col h-[500px] items-center pt-[100px] ">
              <LoadingSpinnerDiamond />
              <p className="text-center">מייבא נתונים...</p>
            </div>
          ) : (
            <Dialog open={!editForm}>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader className="flex flex-row items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
                  <DialogTitle className="text-xl text-red-600 m-0">אין נתונים</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <p className="text-base font-medium">
                    {date
                      ? `לא נמצאו נתונים לתאריך ${format(date, 'dd/MM/yyyy')}. `
                      : 'לא נמצאו נתונים עבור הבחירה הנוכחית.'}
                  </p>
                </div>
                <DialogFooter className="flex justify-end gap-3 mt-6">
                  <Button
                    onClick={() => {
                      setEditForm(true)
                    }}
                  >
                    חזרה
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  )
}
