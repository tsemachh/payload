import dotenv from 'dotenv'

dotenv.config()

export function getMeetingsRetroDays(): number {
  const DEFAULT = 730
  const rawUpper = process.env.MEETINGS_DAYS_RETRO
  const raw = rawUpper ?? String(DEFAULT)
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `MEETINGS_DAYS_RETRO/meettngs_days_retro is invalid ('${rawUpper}'), falling back to default ${DEFAULT} days`,
    )
    return DEFAULT
  }
  // Warn if using deprecated lowercase var
  if (!rawUpper) {
    console.warn('meetings_days_retro is deprecated; please use MEETINGS_DAYS_RETRO in your .env')
  }
  return parsed
}

export function getMeetingsCutoff(): {
  days: number
  cutoffDate: Date
  dateString: string
} {
  const days = getMeetingsRetroDays()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const dateString = cutoffDate.toISOString().slice(0, 10)
  return { days, cutoffDate, dateString }
}

export function getStockValuesRetroDays(): number {
  const DEFAULT = 90
  const rawUpper = process.env.STOCK_VALUE_DAYS_RETRO
  const raw = rawUpper ?? String(DEFAULT)
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `STOCK_VALUE_DAYS_RETRO/stock_value_days_retro is invalid ('${rawUpper}'), falling back to default ${DEFAULT} days`,
    )
    return DEFAULT
  }
  if (!rawUpper) {
    console.warn(
      'stock_value_days_retro is deprecated; please use STOCK_VALUE_DAYS_RETRO in your .env',
    )
  }
  return parsed
}

export function getHoldingsRetroDays(): number {
  const DEFAULT = 90
  const rawUpper = process.env.HOLDINGS_DAYS_RETRO
  const raw = rawUpper ?? String(DEFAULT)
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `HOLDINGS_DAYS_RETRO/holdings_days_retro is invalid ('${rawUpper}'), falling back to default ${DEFAULT} days`,
    )
    return DEFAULT
  }
  if (!rawUpper) {
    console.warn('holdings_days_retro is deprecated; please use HOLDINGS_DAYS_RETRO in your .env')
  }
  return parsed
}
