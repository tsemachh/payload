'use client'

import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface DateSelectorProps {
  date: Date | undefined
  isDateAlwaysOpen?: boolean
  onDateChange: (date: Date | undefined) => void
  className?: string
  filterDate?: (date: Date) => boolean
}

export function DateSelector({
  date,
  isDateAlwaysOpen = false,
  onDateChange,
  className,
  filterDate,
}: DateSelectorProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate)
    setOpen(false)
  }
  return (
    <div className={className}>
      {isDateAlwaysOpen ? (
        <Calendar
          className="w-[250px] border shadow-md"
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          disabled={filterDate}
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
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
              onSelect={handleSelect}
              initialFocus
              disabled={filterDate}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
