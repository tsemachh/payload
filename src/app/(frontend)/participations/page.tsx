'use client'
import { useState } from 'react'
import { useCompaniesContext } from '../context/companiesContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DateRangeSelector } from '../components/ui/date-range-selector'

type DateRangeType = 'month' | 'week' | 'custom'

export default function Participations() {
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined)
  const { companies } = useCompaniesContext()

  const handleRangeChange = (
    newStartDate: Date | undefined,
    newEndDate: Date | undefined,
    type: DateRangeType | undefined,
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
    console.log('Exporting data with:', { startDate, endDate, rangeType, selectedCompany })
    // Add your export logic here
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-center gap-6 mx-auto">
        {' '}
        <div>
          <DateRangeSelector onRangeChange={handleRangeChange} className="w-full" />
        </div>
        <div className="w-[240px]">
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
      </div>

      <div className="flex justify-center ">
        {' '}
        <Button onClick={handleExport} variant="defaultHover" className="ml-600">
          ייצוא
        </Button>
      </div>
    </div>
  )
}
