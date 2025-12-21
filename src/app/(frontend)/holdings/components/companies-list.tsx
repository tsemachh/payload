'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import LoadingSpinnerDiamond from '../../components/ui/loading-spinner-diamond'
import { getWithErrorHandling } from '../../helpers/fetch-helpers'
import { stringify } from 'qs-esm'
import type { Where } from 'payload'
import { X } from 'lucide-react'

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

interface CompaniesListProps {
  companies: Company[]
  selectedDate: Date
}

export function CompaniesList({ companies, selectedDate }: CompaniesListProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loadingCompanyData, setLoadingCompanyData] = useState(false)
  const [companyDateRecords, setCompanyDateRecords] = useState<DateRecord[]>([])

  const handleCompanyClick = async (company: Company) => {
    setSelectedCompany(company)
    setLoadingCompanyData(true)
    setCompanyDateRecords([])

    try {
      // Calculate date range for last 30 days from selected date
      const endDate = new Date(selectedDate)
      const startDate = new Date(selectedDate)
      startDate.setDate(endDate.getDate() - 30)

      // Fetch holdings for this company for the last 30 days
      const query: Where = {
        and: [
          {
            company: {
              equals: company.id,
            },
          },
          {
            valueDate: {
              greater_than_equal: startDate.toISOString(),
              less_than_equal: endDate.toISOString(),
            },
          },
        ],
      }

      const stringifiedQuery = stringify(
        {
          where: query,
          limit: 0,
          select: {
            valueDate: true,
            stats: true,
          },
          depth: 0,
        },
        { addQueryPrefix: true },
      )

      const response = await getWithErrorHandling(`/api/holdings${stringifiedQuery}`, {
        errorMessage: 'שגיאה בטעינת נתוני החברה',
        notifyOnError: true,
      })

      const data = response as any

      // Aggregate by date
      const dateMap = new Map<string, number>()
      data.docs.forEach((holding: any) => {
        const dateStr = new Date(holding.valueDate).toISOString().split('T')[0]
        const recordCount = holding.stats?.recordCount || 0
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + recordCount)
      })

      // Convert to array and sort descending
      const records = Array.from(dateMap.entries())
        .map(([date, recordCount]) => ({ date, recordCount }))
        .sort((a, b) => b.date.localeCompare(a.date))

      setCompanyDateRecords(records)
    } catch (error) {
      console.error('Error fetching company data:', error)
    } finally {
      setLoadingCompanyData(false)
    }
  }
  const onOpenChange = (open: any) => {
    if (!open) {
      setSelectedCompany(null)
      setCompanyDateRecords([])
    }
  }
  return (
    <>
      <Card className="max-h-[400px] flex flex-col">
        <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-muted font-semibold text-sm">
          <div className="text-right">שם חברה</div>
          <div className="text-left">מספר רשומות</div>
        </div>
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 p-4">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleCompanyClick(company)}
                className="w-full text-right p-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-colors flex justify-between items-center gap-4"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  {company.currentRecordCount.toLocaleString()}
                </span>
                <span className="text-sm font-semibold truncate">{company.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Dialog open={!!selectedCompany} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-center text-lg">{selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            {loadingCompanyData ? (
              <div className="flex justify-center items-center h-[200px]">
                <LoadingSpinnerDiamond />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border">
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted font-semibold text-sm">
                    <div className="text-right">מספר רשומות</div>
                    <div className="text-right">תאריך</div>
                  </div>
                  {companyDateRecords.length > 0 ? (
                    companyDateRecords.map((record, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-2 gap-2 p-3 border-t hover:bg-accent/50 transition-colors"
                      >
                        <div className="text-right text-sm font-medium">
                          {record.recordCount.toLocaleString()}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {new Date(record.date).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">אין נתונים</div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
