/**
 * Utility functions for date parsing and formatting
 */
import { parse } from 'date-fns'
import moment from 'moment'

/**
 * Sets a date to midnight (00:00:00)
 * @param date - The date to set to midnight
 * @returns A new date set to midnight
 */
export const setToMidnight = (date: Date): Date => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Parses a date string in the format "DD/MM/YYYY HH:MM:SS" to a JavaScript Date object
 * Using date-fns library for parsing
 * @param dateStr - The date string to parse (e.g., "30/04/2025 15:00:00")
 * @returns A JavaScript Date object
 */
export function parseDateString(dateStr: string | Date): Date {
  if (!dateStr) {
    throw new Error('Date string is empty or undefined')
  }

  // New: if the incoming value is already a Date, return it as-is
  if (dateStr instanceof Date) {
    return dateStr
  }

  try {
    const trimmed = dateStr.trim()

    // If the string uses slashes, assume day-first format (dd/MM/yyyy ...)
    if (trimmed.includes('/')) {
      // Try with time (HH:mm:ss) and without time
      const withSeconds = parse(trimmed, 'dd/MM/yyyy HH:mm:ss', new Date())
      if (!isNaN(withSeconds.getTime())) return withSeconds

      const withoutTime = parse(trimmed, 'dd/MM/yyyy', new Date())
      if (!isNaN(withoutTime.getTime())) return withoutTime
    }

    // Otherwise, rely on native Date for ISO/RFC-compliant strings
    const jsDate = new Date(trimmed)
    if (!isNaN(jsDate.getTime())) return jsDate

    // Last resort: try day-first with seconds
    const fallback = parse(trimmed, 'dd/MM/yyyy HH:mm:ss', new Date())
    return fallback
  } catch (error) {
    throw new Error(`Failed to parse date string: ${dateStr}`)
  }
}

/**
 * Checks if two dates are on the same day
 * @param date1 - The first date
 * @param date2 - The second date
 * @returns True if the dates are on the same day, false otherwise
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Adds a specified number of days to a date
 * @param date - The original date
 * @param days - The number of days to add
 * @returns A new date with the added days
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(date.getDate() + days)
  return result
}

/**
 * Formats a date string into a relative time string in Hebrew
 * @param dateString - The date string to format
 * @returns A string representing the relative time in Hebrew
 */
export const formatRelativeTime = (dateString: string) => {
  const date = moment(dateString)
  return moment(date).locale('he').fromNow()
}
 export const normalizeDate = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}