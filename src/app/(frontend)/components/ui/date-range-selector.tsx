'use client'

import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, ChevronDown, Check } from 'lucide-react' // Import Check icon
import { cn } from '@/lib/utils'
import { DateSelector } from '../../holdings/components/DateSelector'
import { startOfDay, endOfDay, subDays, subMonths, subYears, format } from 'date-fns'
import { he } from 'date-fns/locale' // Import Hebrew locale

type DateRangeOption = 'two-years' | 'one-year' | 'month' | 'week' | 'custom'

interface DateRange {
  start: Date | undefined
  end: Date | undefined
}

export const getDateRange = (
  option: DateRangeOption,
  customStart?: Date,
  customEnd?: Date,
): DateRange => {
  const now = new Date()
  const todayEnd = endOfDay(now)

  switch (option) {
    case 'week':
      return {
        start: startOfDay(subDays(now, 6)),
        end: todayEnd,
      }
    case 'month':
      return {
        start: startOfDay(subMonths(now, 1)),
        end: todayEnd,
      }
    case 'one-year':
      return {
        start: startOfDay(subYears(now, 1)),
        end: todayEnd,
      }
    case 'two-years':
      return {
        start: startOfDay(subYears(now, 2)),
        end: todayEnd,
      }
    case 'custom':
      return {
        start: customStart ? startOfDay(customStart) : undefined,
        end: customEnd ? endOfDay(customEnd) : undefined,
      }
    default:
      return { start: undefined, end: undefined }
  }
}

interface DateRangeSelectorProps {
  onRangeChange: (
    startDate: Date | undefined,
    endDate: Date | undefined,
    type: DateRangeOption,
  ) => void
  className?: string
}

export function DateRangeSelector({ onRangeChange, className }: DateRangeSelectorProps) {
  const [selectedRangeOption, setSelectedRangeOption] = useState<DateRangeOption | undefined>(
    undefined,
  )
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>() // For custom range in popover
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>() // For custom range in popover
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Effect to update parent when startDate/endDate/rangeType change
  useEffect(() => {
    onRangeChange(startDate, endDate, selectedRangeOption!)
  }, [startDate, endDate, selectedRangeOption, onRangeChange])

  const handleOptionSelect = (option: DateRangeOption) => {
    setSelectedRangeOption(option)
    if (option === 'custom') {
      // Initialize temp dates with current applied dates if any, or clear
      setTempStartDate(undefined)
      setTempEndDate(undefined)
      // Popover remains open for custom selection
    } else {
      const { start, end } = getDateRange(option)
      setStartDate(start)
      setEndDate(end)
      setPopoverOpen(false) // Close popover for predefined options
    }
  }

  const handleApplyCustomRange = () => {
    if (!tempStartDate || !tempEndDate) {
      // Optionally, add some user feedback here, e.g., a toast message
      return // Prevent applying if dates are not selected
    }
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    setSelectedRangeOption('custom')
    setPopoverOpen(false)
  }

  const handleCancelCustomRange = () => {
    setTempStartDate(undefined)
    setTempEndDate(undefined)
    setSelectedRangeOption(undefined) // Clear selection when canceling custom range
    setPopoverOpen(false)
  }

  const formatSelectedRange = () => {
    if (selectedRangeOption === 'custom') {
      if (startDate && endDate) {
        return `${format(endDate, 'dd/MM/yyyy', { locale: he })} - ${format(startDate, 'dd/MM/yyyy', { locale: he })}`
      } else if (startDate) {
        return `מ- ${format(startDate, 'dd/MM/yyyy', { locale: he })}`
      } else if (endDate) {
        return `עד- ${format(endDate, 'dd/MM/yyyy', { locale: he })}`
      }
      return 'טווח מותאם אישית' // Fallback if custom is selected but dates are missing
    }

    if (!selectedRangeOption) {
      return 'בחר אפשרויות'
    }

    // For predefined options, only return the date range
    if (startDate && endDate) {
      return `${format(endDate, 'dd/MM/yyyy', { locale: he })} - ${format(startDate, 'dd/MM/yyyy', { locale: he })}`
    }
    return 'בחר אפשרויות' // Fallback if no dates are set for predefined
  }

  const OptionItem = ({ option, label }: { option: DateRangeOption; label: string }) => (
    <div
      className="flex items-center justify-between cursor-pointer hover:bg-gray-100 p-1 rounded text-right"
      onClick={() => handleOptionSelect(option)}
    >
      <span>{label}</span>
      {selectedRangeOption === option && <Check className="h-4 w-4 text-primary" />}
    </div>
  )

  return (
    <div className={cn('flex items-center gap-3', className)} dir="rtl">
      <label className="text-base font-semibold text-right whitespace-nowrap"> טווח תאריכים</label>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[350px] h-10 px-3 py-2 justify-between text-right font-normal flex-row-reverse', // Added h-10 and px-3 py-2
              !selectedRangeOption && 'text-muted-foreground',
            )}
          >
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-right">
              {formatSelectedRange()}
            </span>
            <CalendarIcon className="h-4 w-4 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start" dir="rtl">
          <div className="p-4">
            <div className="space-y-2 text-sm">
              <OptionItem option="two-years" label="שנתיים" />
              <OptionItem option="one-year" label="שנה" />
              <OptionItem option="month" label="חודש" />
              <OptionItem option="week" label="שבוע" />
              <OptionItem option="custom" label="טווח מותאם אישית" />
            </div>

            {selectedRangeOption === 'custom' && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-bold mb-2 text-center">טווח מותאם אישית</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-end gap-2">
                    <label className="text-sm font-medium whitespace-nowrap min-w-[60px] text-end">
                      מתאריך
                    </label>
                    <DateSelector
                      date={tempStartDate}
                      onDateChangeAction={setTempStartDate}
                      className="flex-1"
                      filterDate={(date) => {
                        const now = new Date()
                        now.setHours(0, 0, 0, 0)
                        const day = date.getDay()
                        return day === 5 || day === 6 || date > now
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <label className="text-sm font-medium whitespace-nowrap min-w-[60px] text-end">
                      עד{' '}
                    </label>
                    <DateSelector
                      date={tempEndDate}
                      onDateChangeAction={setTempEndDate}
                      className="flex-1"
                      filterDate={(date) => {
                        const now = new Date()
                        now.setHours(0, 0, 0, 0)
                        const day = date.getDay()
                        return day === 5 || day === 6 || date > now
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    onClick={handleApplyCustomRange}
                    disabled={!tempStartDate || !tempEndDate}
                  >
                    החל
                  </Button>{' '}
                  <Button variant="outline" onClick={handleCancelCustomRange}>
                    ביטול
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
