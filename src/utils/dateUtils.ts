/**
 * Utility functions for date parsing and formatting
 */
import { parse } from 'date-fns';

/**
 * Parses a date string in the format "DD/MM/YYYY HH:MM:SS" to a JavaScript Date object
 * Using date-fns library for parsing
 * @param dateStr - The date string to parse (e.g., "30/04/2025 15:00:00")
 * @returns A JavaScript Date object
 */
export function parseDateString(dateStr: string): Date {
  if (!dateStr) {
    throw new Error("Date string is empty or undefined");
  }

  try {
    // Use date-fns to parse the date string
    // Format: dd/MM/yyyy HH:mm:ss
    return parse(dateStr, 'dd/MM/yyyy HH:mm:ss', new Date());
  } catch (error) {
    throw new Error(`Failed to parse date string: ${dateStr}`);
  }
}

