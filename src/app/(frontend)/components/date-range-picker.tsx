'use client'

import type * as React from 'react'
import { CalendarIcon } from '@radix-ui/react-icons'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { he } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'

export function DateRangePicker({
  className,
  dateRange,
  onDateRangeChange,
}: React.HTMLAttributes<HTMLDivElement> & {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[300px] justify-start text-right font-normal',
              !dateRange && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'dd LLL y', { locale: he })} -{' '}
                  {format(dateRange.to, 'dd LLL y', { locale: he })}
                </>
              ) : (
                format(dateRange.from, 'dd LLL y', { locale: he })
              )
            ) : (
              <span>בחר טווח תאריכים</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="flex space-x-4 space-x-reverse">
              <div>
                <Label htmlFor="from" className="block mb-2">
                  החל מתאריך
                </Label>
                <Calendar
                  id="from"
                  mode="single"
                  selected={dateRange?.from}
                  onSelect={(date) => onDateRangeChange({ from: date, to: dateRange?.to })}
                  initialFocus
                  locale={he}
                />
              </div>
              <div className="border-r border-gray-200"></div>
              <div>
                <Label htmlFor="to" className="block mb-2">
                  עד תאריך
                </Label>
                <Calendar
                  id="to"
                  mode="single"
                  selected={dateRange?.to}
                  onSelect={(date) => onDateRangeChange({ from: dateRange?.from, to: date })}
                  initialFocus
                  locale={he}
                  fromDate={dateRange?.from}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
