import { isWithinInterval } from 'date-fns'
import {
  Column,
  DateFilterOption,
  CompanyTableDate,
  MeetingTableDataType,
  FacetedFilterItemServer,
  CustomDate,
  selectOptionType,
} from '../types/meetings'
import { handleApiError } from './error-handler'
import { postWithErrorHandling } from './fetch-helpers'
import {
  booleanOptions,
  futureDateFilterOptions,
  meetingStateOptions,
  meetingTypeOptions,
  pastDateFilterOptions,
  stockOriginOptions,
  stockTypeOptions,
} from '../meetings/filtersConst'
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns'

export const formatDateTime = (originDate: string, withoutTime?: boolean) => {
  if (!originDate) return ' '
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
  fund: boolean = false,
) => {
  const firstValueColumnIndex = columns.findIndex(
    (col) => col.key !== 'companyName' && col.key in company,
  )

  if (firstValueColumnIndex === -1) return '600px'

  const columnCount = columns.length
  let totalWidth = 0
  for (let i = 1; i < firstValueColumnIndex; i++) {
    const minWidth = columns[i]?.minWidth ?? 100
    const columnWidth = calculateColumnWidths(minWidth, columnCount)
    totalWidth += columnWidth
  }
  if (fund) {
    totalWidth -= 80
  } else {
    totalWidth -= 35
  }

  return `${totalWidth}px`
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
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`API error: ${res.status} - ${errText}`)
    }
    return res.json()
  } catch (error) {
    // Log detailed error but don't notify (SWR will handle notification)
    handleApiError(error, `Error fetching data from ${url}`, true)
    throw error
  }
}

export const postFetcher = async ([url, bodyData]: [string, object]) => {
  try {
    // Use postWithErrorHandling but disable notifications since SWR will handle them
    return await postWithErrorHandling(url, bodyData, {
      notifyOnError: false,
      errorMessage: `Error posting data to ${url}`
    });
  } catch (error) {
    // Just rethrow the error after it's been logged by postWithErrorHandling
    throw error;
  }
}

export const getVotingRecommendationColor = (recommendation: string) => {
  if (recommendation === 'בעד') {
    return 'text-green-600'
  } else if (recommendation === 'נגד') {
    return 'text-red-600'
  } else {
    return 'text-gray-900'
  }
}

export const getStaticFilterOptions = (
  columnKey: string,
  columnType?: string,
): FacetedFilterItemServer[] => {
  switch (columnKey) {
    case 'stockType':
      return stockTypeOptions.map((option: selectOptionType) => ({
        value: option.value,
        translate: option.label,
      }))
    case 'stockOrigin':
      return stockOriginOptions.map((option: selectOptionType) => ({
        value: option.value,
        translate: option.label,
      }))
    case 'meetingType':
      return meetingTypeOptions.map((option: selectOptionType) => ({
        value: option.value,
        translate: option.label,
      }))

    case 'meetingState':
      return meetingStateOptions.map((option: selectOptionType) => ({
        value: option.value,
        translate: option.label,
      }))
    default:
      if (columnType === 'boolean') {
        return booleanOptions
      }
      return []
  }
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
      return {
        start: startOfDay(subDays(yesterday, 6)),
        end: endOfDay(yesterday),
      }
    case 'lastMonth':
      return {
        start: startOfDay(subDays(yesterday, 29)),
        end: endOfDay(yesterday),
      }
    case 'allPast':
      return { start: new Date(-8640000000000000), end: endOfDay(yesterday) } // Min date
    default:
      return { start: today, end: today }
  }
}

export const updateFilter = (
  option: string,
  checked: boolean,
  currentFilter: any,
  customDate?: CustomDate,
) => {
  const newFilter = { ...currentFilter }

  if (option === 'empty') {
    // Toggle the empty filter
    newFilter.empty = checked
  } else if (option === 'custom') {
    // Handle custom date range toggle
    newFilter.custom = checked
    newFilter.customDate = customDate
  } else if (isDateOption(option, pastDateFilterOptions)) {
    // If unchecking, clear the past filter
    if (!checked) {
      newFilter.past = ''
    } else {
      // Replace the past filter with the new option
      newFilter.past = option
    }
  } else if (isDateOption(option, futureDateFilterOptions)) {
    // If unchecking, clear the future filter
    if (!checked) {
      newFilter.future = ''
    } else {
      // Replace the future filter with the new option
      newFilter.future = option
    }
  }

  return newFilter
}
