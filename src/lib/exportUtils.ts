import { LogLevel } from '@logtail/types'
import { GroupedMeetingData } from './exportTypes'

/**
 * Return a Logtail `LogLevel` based on the Pino level
 * @param level number - Pino log level
 */
export function getLogLevel(level: number): LogLevel {
  // Trace 10
  if (level <= 10) {
    return LogLevel.Trace
  }

  // Debug
  if (level <= 20) {
    return LogLevel.Debug
  }

  // Info
  if (level <= 30) {
    return LogLevel.Info
  }

  // Warn
  if (level <= 40) {
    return LogLevel.Warn
  }

  // Error
  if (level <= 50) {
    return LogLevel.Error
  }
  // Everything above this level is considered fatal
  return LogLevel.Fatal
}

// Utility functions
export function formatNormalDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function booleanToIcon(value: any): string {
  if (value === true) return 'V'
  if (value === false) return '-'
  return ''
}
