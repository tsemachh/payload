import { isWithinInterval } from 'date-fns'
import { Column, DateFilterOption, CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import { Company, StockValue } from '@/payload-types'

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
  if (firstValueColumnIndex === -1) return '500px'

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
  // account: Account | string, //TODO: add holdingsCompanyName
  company: Company | string,
  quantity: number,
  stockValues: StockValue | null | undefined | string,
) => {
  let safeStockValue
  if (typeof stockValues == 'object') {
    safeStockValue = stockValues
  } else {
    safeStockValue = { registeredValue: 0, closingRate: 0 }
  }

  const holdingsCompanyName = typeof company === 'object' ? company.name : 'Unknown Account'
  const registeredValue = parseNumber(safeStockValue?.registeredValue)
  const closingRate = parseNumber(safeStockValue?.closingRate)
  const percentageHolding = parseFloat(((quantity / registeredValue) * 100).toFixed(2))

  const holdingValueInMillions = Math.round((quantity * closingRate) / 100000000)

  return {
    holdingsCompanyName,
    percentageHolding,
    holdingValueInMillions,
    nominalValue: Math.round(quantity),
  }
}

export const isRTL = (text: string): boolean => {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF]/ // Hebrew + Arabic ranges
  return rtlChars.test(text)
}

// Helper to clean and parse value (handles number or string with commas)
export const parseNumber = (value: string | number | undefined | null): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API error [api/meetings/all-meetings]: ${res.status} - ${errText}`)
  }
  return res.json()
}
