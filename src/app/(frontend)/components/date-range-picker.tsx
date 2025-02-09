import type * as React from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function DateRangePicker({
                                  className,
                                  dateRange,
                                  onDateRangeChange,
                                }: React.HTMLAttributes<HTMLDivElement> & {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn("w-[300px] justify-start text-right font-normal", !dateRange && "text-muted-foreground")}
          >
            <CalendarIcon className="ml-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "dd LLL y", { locale: he })} -{" "}
                  {format(dateRange.to, "dd LLL y", { locale: he })}
                </>
              ) : (
                format(dateRange.from, "dd LLL y", { locale: he })
              )
            ) : (
              <span>בחר תאריך</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            locale={he}
            required // Add the required property here
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
