'use client'

import { useState } from 'react'
import { useCompaniesContext } from '../context/companiesContext' // Assuming this context exists
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DateRangeSelector } from '../components/ui/date-range-selector' // Updated path if needed

type DateRangeType = 'month' | 'week' | 'custom'
type ReportType = 'daily' | 'monthly' | 'yearly' | 'custom' // New type for report types

export default function Participations() {
  const { companies } = useCompaniesContext() // Moved hook call to the top level
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined)
  const [selectedReportType, setSelectedReportType] = useState<ReportType | undefined>(undefined) // New state for report type

  // Mock useCompaniesContext if it's not provided, for demonstration purposes
  // const { companies } = useCompaniesContext ? useCompaniesContext() : { companies: [{ id: '1', name: 'חברה א׳' }, { id: '2', name: 'חברה ב׳' }] };

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType, // Type is now always defined
  ) => {
    setStartDate(newStartDate)
    setEndDate(newEndDate)
    setRangeType(type)
    console.log('Date range changed:', {
      startDate: newStartDate,
      endDate: newEndDate,
      type,
    })
  }

  const handleExport = () => {
    console.log('Exporting data with:', {
      startDate,
      endDate,
      rangeType,
      selectedCompany,
      selectedReportType,
    })
    // Add your export logic here
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row justify-center gap-6 mx-auto">
        {/* Date Range Selector */}
        <div className="w-full md:w-[280px] min-h-[200px]">
          <DateRangeSelector onRangeChange={handleRangeChange} />
        </div>
        {/* Company Selector */}
        <div className="w-full md:w-[240px]">
          <label className="text-base font-semibold mb-2 block text-right">חברה</label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="min-w-[240px] flex-row-reverse justify-between text-right">
              <SelectValue placeholder="בחר חברה" />
            </SelectTrigger>
            <SelectContent align="end" dir="rtl">
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-[240px]">
          <label className="text-base font-semibold mb-2 block text-right">סוג דוח</label>
          <Select
            value={selectedReportType}
            onValueChange={(value) => setSelectedReportType(value as ReportType)}
          >
            <SelectTrigger className="min-w-[240px] flex-row-reverse justify-between text-right">
              <SelectValue placeholder="בחר סוג דוח" />
            </SelectTrigger>
            <SelectContent align="end" dir="rtl">
              <SelectItem value="voted-diff-from-recommendation">
                אסיפות עם הצבעה שונה מההמלצה
              </SelectItem>
              <SelectItem value="voted-diff-from-results">אסיפות עם הצבעה שונה מהחלטה</SelectItem>
              <SelectItem value="dual-foreign-meetings">אסיפות של מניות דואליות (צד זר)</SelectItem>
              <SelectItem value="search-topics">בחירה לפי חיפוש טקסטואלי בנושאים</SelectItem>
              <SelectItem value="only-foreign-stocks">הצגה רק של מניות זרות</SelectItem>
              <SelectItem value="only-dual-stocks">הצגה רק של מניות דואליות</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-center mt-24 ">
        <Button onClick={handleExport} variant="defaultHover">
          ייצוא
        </Button>
      </div>
    </div>
  )
}
