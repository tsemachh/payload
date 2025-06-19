/**
 * Utility functions for date parsing and formatting
 */
import { parse } from 'date-fns'

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
export function parseDateString(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Date string is empty or undefined')
  }

  try {
    // Use date-fns to parse the date string
    // Format: dd/MM/yyyy HH:mm:ss
    return parse(dateStr, 'dd/MM/yyyy HH:mm:ss', new Date())
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
