'use client'

import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateSelector } from '../../holdings/components/DateSelector'
import { startOfDay, endOfDay, subDays, subMonths, subYears, format } from 'date-fns'
import { he } from 'date-fns/locale'

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
  onRangeChangeAction: (
    startDate: Date | undefined,
    endDate: Date | undefined,
    type: DateRangeOption,
  ) => void
  className?: string
}

export function DateRangeSelector({ onRangeChangeAction, className }: DateRangeSelectorProps) {
  const [selectedRangeOption, setSelectedRangeOption] = useState<DateRangeOption | undefined>(
    undefined,
  )
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>()
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>()
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    onRangeChangeAction(startDate, endDate, selectedRangeOption!)
  }, [startDate, endDate, selectedRangeOption])

  const handleOptionSelect = (option: DateRangeOption) => {
    setSelectedRangeOption(option)
    if (option === 'custom') {
      setTempStartDate(undefined)
      setTempEndDate(undefined)
    } else {
      const { start, end } = getDateRange(option)
      setStartDate(start)
      setEndDate(end)
      setPopoverOpen(false)
    }
  }

  const handleApplyCustomRange = () => {
    if (!tempStartDate || !tempEndDate) {
      return
    }
    setStartDate(tempStartDate)
    setEndDate(tempEndDate)
    setSelectedRangeOption('custom')
    setPopoverOpen(false)
  }

  const handleCancelCustomRange = () => {
    setTempStartDate(undefined)
    setTempEndDate(undefined)
    setSelectedRangeOption(undefined)
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
      return 'טווח מותאם אישית'
    }

    if (!selectedRangeOption) {
      return 'בחר אפשרויות'
    }

    if (startDate && endDate) {
      return `${format(endDate, 'dd/MM/yyyy', { locale: he })} - ${format(startDate, 'dd/MM/yyyy', { locale: he })}`
    }
    return 'בחר אפשרויות'
  }

  const OptionItem = ({ option, label }: { option: DateRangeOption; label: string }) => (
    <div
      className="flex items-center justify-between cursor-pointer hover:bg-muted p-1 rounded text-right"
      onClick={() => handleOptionSelect(option)}
    >
      <span>{label}</span>
      {selectedRangeOption === option && <Check className="h-4 w-4 text-primary" />}
    </div>
  )

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outlineWithputHover"
          className={cn(
            'w-[350px] h-10 px-3 py-2 justify-between text-right font-normal flex-row-reverse',
            !selectedRangeOption && 'text-muted-foreground',
            className,
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

      {selectedRangeOption === "custom" && (
        <div className="mt-6 pt-6 border-t border-border/50 w-[320px]">
          <div className="space-y-4">
            <div className="space-y-4 p-4 rounded-lg">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-muted-foreground text-right">
                  מתאריך
                </label>
                <div className="w-full max-w-[180px]">
                  <DateSelector
                    date={tempStartDate}
                    onDateChangeAction={setTempStartDate}
                    className="w-full"
                    filterDate={(date) => {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      const day = date.getDay();
                      return day === 5 || day === 6 || date > now;
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-medium text-muted-foreground text-right">
                  עד תאריך
                </label>
                <div className="w-full max-w-[180px]">
                  <DateSelector
                    date={tempEndDate}
                    onDateChangeAction={setTempEndDate}
                    className="w-full"
                    filterDate={(date) => {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      const day = date.getDay();
                      return day === 5 || day === 6 || date > now;
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 ml-[40px] mt-[-10px]">
              <Button
                variant="outline"
                onClick={handleCancelCustomRange}
                className="px-6 text-sm bg-transparent"
              >
                ביטול
              </Button>
              <Button
                onClick={handleApplyCustomRange}
                disabled={!tempStartDate || !tempEndDate}
                className="px-6 text-sm bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                החל טווח
              </Button>
            </div>

            {(!tempStartDate || !tempEndDate) && (
              <p className="text-xs text-muted-foreground text-right mt-2">
                יש לבחור תאריך התחלה וסיום
              </p>
            )}
          </div>
        </div>
      )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
