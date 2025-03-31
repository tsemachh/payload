import { isWithinInterval } from 'date-fns'
import { Column, DateFilterOption, CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import { Account, StockValue } from '@/payload-types'

export const formatDateTime = (originDate: string, withoutTime?: boolean) => {
  if (!originDate) return '-'
  const date = new Date(originDate)
  if (isNaN(date.getTime())) return '-'
  const newDate = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', // Force the correct timezone
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll('.', '/')

  return withoutTime ? newDate.split(',')[0] : newDate.replace(/\./g, '/').replace(', ', ' ')
}

export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const isDateInRange = (date: Date, range: { start: Date; end: Date }): boolean => {
  return isWithinInterval(date, range)
}

// Helper function to check if an option is in the past / future category
export const isDateOption = (option: string, dateFilterOptions: DateFilterOption[]): boolean => {
  return dateFilterOptions.some((item) => item.value === option)
}

export const isValidDate = (date: any): boolean => {
  if (!date) return false
  const d = new Date(date)
  return !isNaN(d.getTime())
}

export const calculateColumnWidths = (
  minWidth: number,
  columnCount: number,
  width?: number,
): number => {
  if (width) {
    return width
  }
  const screenWidth = window.innerWidth
  return Math.max((screenWidth / columnCount) * (minWidth / 100), minWidth)
}

export const calculatePrecedingColumnsWidth = (
  columns: Column<MeetingTableDataType>[],
  company: CompanyTableDate,
) => {
  const firstValueColumnIndex = columns.findIndex((col) => col.key in company)
  if (firstValueColumnIndex === -1) return '100%'

  const columnCount = columns.length
  let totalWidth = 0
  for (let i = 1; i < firstValueColumnIndex; i++) {
    const minWidth = columns[i]?.minWidth ?? 100 // אם אין minWidth, משתמשים ב-100 ברירת מחדל
    const columnWidth = calculateColumnWidths(minWidth, columnCount)
    totalWidth += columnWidth
  }
  return `${totalWidth}px`
}

export const calculateHoldingValues = (
  account: Account | string,
  quantity: number,
  stockValues: StockValue | null,
) => {
  const holdingsCompanyName = typeof account === 'object' ? account.name : 'Unknown Account'

  const percentageHolding = stockValues?.registeredValue
    ? parseFloat(((quantity / stockValues.registeredValue) * 100).toFixed(2))
    : 0

  const holdingValueInMillions = stockValues?.closingRate
    ? Math.round((quantity * stockValues.closingRate) / 100000000)
    : 0

  return {
    holdingsCompanyName,
    percentageHolding,
    holdingValueInMillions,
    nominalValue: Math.round(quantity),
  }
}
