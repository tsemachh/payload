'use client'

import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateSelectorProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  className?: string
  filterDate?: (date: Date) => boolean
}

export function DateSelector({ date, onDateChange, className, filterDate }: DateSelectorProps) {
  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'min-w-[240px] justify-start text-right font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : <span>בחר תאריך</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            initialFocus
            disabled={filterDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
