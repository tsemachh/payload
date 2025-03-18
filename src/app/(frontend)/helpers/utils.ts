import { isWithinInterval } from 'date-fns'
import { DateFilterOption } from '../types/meetings'

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
