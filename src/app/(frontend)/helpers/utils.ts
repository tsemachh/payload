import { addDays, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { DateFilterOption } from '../types'

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

export const getDateRange = (option: string): { start: Date; end: Date } => {
  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)

  switch (option) {
    case 'today':
      return { start: today, end: endOfDay(today) }
    case 'nextWeek':
      return { start: today, end: endOfDay(addDays(today, 7)) }
    case 'nextMonth':
      return { start: today, end: endOfDay(addDays(today, 30)) }
    case 'allFuture':
      return { start: today, end: new Date(8640000000000000) } // Max date
    case 'yesterday':
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) }
    case 'lastWeek':
      return { start: startOfDay(subDays(yesterday, 6)), end: endOfDay(yesterday) }
    case 'lastMonth':
      return { start: startOfDay(subDays(yesterday, 29)), end: endOfDay(yesterday) }
    case 'allPast':
      return { start: new Date(-8640000000000000), end: endOfDay(yesterday) } // Min date
    default:
      return { start: today, end: today }
  }
}

export const isDateInRange = (date: Date, range: { start: Date; end: Date }): boolean => {
  return isWithinInterval(date, range)
}

// Helper function to check if an option is in the past / future category
export const isDateOption = (option: string, dateFilterOptions: DateFilterOption[]): boolean => {
  return dateFilterOptions.some((item) => item.value === option)
}
