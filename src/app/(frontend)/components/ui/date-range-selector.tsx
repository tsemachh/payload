'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { CalendarRange, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateSelector } from '../../holdings/components/DateSelector'
import { startOfDay, endOfDay, addDays, subDays, subMonths } from 'date-fns'

export const getCustomDateRange = (
  option: 'week' | 'month' | 'custom',
  customStartDate?: Date,
  customEndDate?: Date,
): { start: Date; end: Date } => {
  const today = endOfDay(new Date())

  switch (option) {
    case 'week':
      return {
        start: startOfDay(subDays(today, 6)),
        end: today,
      }
    case 'month':
      return {
        start: startOfDay(subMonths(today, 1)),
        end: today,
      }
    case 'custom':
      return {
        start: startOfDay(customStartDate ?? today),
        end: endOfDay(customEndDate ?? today),
      }
    default:
      return {
        start: today,
        end: today,
      }
  }
}

type DateRangeType = 'month' | 'week' | 'custom'

interface DateRangeSelectorProps {
  onRangeChange: (
    startDate: Date | undefined,
    endDate: Date | undefined,
    type: DateRangeType,
  ) => void
  className?: string
}

export function DateRangeSelector({ onRangeChange, className }: DateRangeSelectorProps) {
  const [rangeType, setRangeType] = useState<DateRangeType | undefined>(undefined)
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()

  const handleRangeTypeChange = (value: DateRangeType) => {
    setRangeType(value)

    if (value === 'custom') {
      setStartDate(undefined)
      setEndDate(undefined)
      onRangeChange(undefined, undefined, value)
      return
    }

    const { start, end } = getCustomDateRange(value)
    setStartDate(start)
    setEndDate(end)
    onRangeChange(start, end, value)
  }

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date)
    onRangeChange(date, endDate, rangeType!)
  }

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date)
    onRangeChange(startDate, date, rangeType!)
  }

  const formatRangeDates = (start?: Date, end?: Date) =>
    start && end
      ? `(${start.toLocaleDateString('he-IL')} - ${end.toLocaleDateString('he-IL')})`
      : ''

  const getLabelForRangeType = (type: DateRangeType) => {
    switch (type) {
      case 'month':
        return 'החודש'
      case 'week':
        return 'השבוע'
      case 'custom':
        return 'אחר'
      default:
        return ''
    }
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div>
        <label className="text-base font-semibold mb-2 block text-right">
          טווח תאריכים להנפקת דו״ח
        </label>
        <Select value={rangeType} onValueChange={handleRangeTypeChange}>
          <SelectTrigger
            className={cn(
              'min-w-[280px] justify-between text-right font-normal flex-row-reverse',
              !rangeType && 'text-muted-foreground',
            )}
          >
            <div className="flex flex-row-reverse items-center">
              <CalendarRange className="ml-2 h-4 w-4" />
              <div className="text-right">
                {rangeType
                  ? `${getLabelForRangeType(rangeType)} ${
                      rangeType !== 'custom' ? formatRangeDates(startDate, endDate) : ''
                    }`
                  : 'בחר טווח'}
              </div>
            </div>
          </SelectTrigger>
          <SelectContent align="end" dir="rtl">
            <SelectItem value="month">החודש</SelectItem>
            <SelectItem value="week">השבוע</SelectItem>
            <SelectItem value="custom">אחר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rangeType === 'custom' && (
        <div className="flex gap-4" dir="rtl">
          <div className="flex-1">
            <label className="text-base font-semibold mb-2 block text-right"> התחלה</label>
            <DateSelector
              date={startDate}
              onDateChangeAction={handleStartDateChange}
              className="w-full"
              filterDate={(date) => {
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                const day = date.getDay()
                return day === 5 || day === 6 || date > now
              }}
            />
          </div>
          <div className="flex-1">
            <label className="text-base font-semibold mb-2 block text-right"> סיום</label>
            <DateSelector
              date={endDate}
              onDateChangeAction={handleEndDateChange}
              className="w-full"
              filterDate={(date) => {
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                const day = date.getDay()
                return day === 5 || day === 6 || date > now
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
