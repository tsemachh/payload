import { FieldHook } from 'payload'
import Holidays from 'date-holidays'

const hd = new Holidays('IL')

/**
 * Check if a given date is a working day (not Sabbath and not a holiday)
 * @param date - The date to check
 * @returns true if it's a working day, false if it's Sabbath or holiday
 */
export const isWorkingDay = (date: Date): boolean => {
  const dayOfWeek = date.getDay() // 0=Sun, 6=Sat

  // Check if it's Sabbath (Friday evening to Saturday evening)
  // In Israeli business context, Friday and Saturday are non-working days
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    return false
  }

  // Check if it's a holiday using date-holidays library
  const holidays = hd.getHolidays(date.getFullYear())
  const inputDate = date.toISOString().split('T')[0]

  const holiday = holidays.find((holiday) => {
    const holidayDate = new Date(holiday.date).toISOString().split('T')[0]
    return holidayDate === inputDate && holiday.type === 'public'
  })

  // Return false if it's a public holiday (non-working day)
  if (holiday !== undefined) {
    return false
  }

  // Special case: Erev Yom Kippur (day before Yom Kippur) is non-working
  const yomKippurHoliday = holidays.find((h) => h.name.includes('יום כיפור'))
  if (yomKippurHoliday) {
    const yomKippurDate = new Date(yomKippurHoliday.date)
    const erevYomKippurDate = new Date(yomKippurDate.getTime() - 24 * 60 * 60 * 1000)
    const erevYomKippurDateStr = erevYomKippurDate.toISOString().split('T')[0]

    if (inputDate === erevYomKippurDateStr) {
      return false // Erev Yom Kippur is non-working
    }
  }

  // It's a working day (Sunday-Thursday, not a holiday)
  return true
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use isWorkingDay instead
 */
export const isHolidayOrShabbat = (date: Date): boolean => {
  return !isWorkingDay(date)
}

export const getWorkingDateBefore = (date: Date, workingDaysBefore: number, hour: number): Date => {
  const result = new Date(date)
  result.setHours(hour, 0, 0, 0)

  let daysLeft = workingDaysBefore
  while (daysLeft > 0) {
    result.setDate(result.getDate() - 1)
    if (isWorkingDay(result)) {
      daysLeft--
    }
  }

  return result
}

/**
 * Get a date that is a specified number of working days after the given date
 */
export const getWorkingDateAfter = (date: Date, workingDaysAfter: number, hour: number): Date => {
  const result = new Date(date)
  result.setHours(hour, 0, 0, 0)

  let daysLeft = workingDaysAfter
  while (daysLeft > 0) {
    result.setDate(result.getDate() + 1)
    if (isWorkingDay(result)) {
      daysLeft--
    }
  }

  return result
}

const getTwoHoursBeforeWithinWorkingHours = (date: Date): Date => {
  const result = new Date(date)
  result.setSeconds(0)
  result.setMilliseconds(0)

  const WORK_DAY_START_HOUR = 8
  const WORK_DAY_END_HOUR = 17

  const meetingHour = result.getHours()
  const meetingMinutes = result.getMinutes()

  result.setMinutes(meetingMinutes)
  result.setHours(meetingHour - 2)

  if (result.getHours() < WORK_DAY_START_HOUR) {
    const diffMinutes = WORK_DAY_START_HOUR * 60 - (result.getHours() * 60 + result.getMinutes())
    result.setDate(result.getDate() - 1)
    while (!isWorkingDay(result)) {
      result.setDate(result.getDate() - 1)
    }
    const endOfWork = new Date(result)
    endOfWork.setHours(WORK_DAY_END_HOUR, 0, 0, 0)
    endOfWork.setMinutes(endOfWork.getMinutes() - diffMinutes)

    result.setHours(endOfWork.getHours(), endOfWork.getMinutes(), 0, 0)
  }

  return result
}

export const calculateHoldingDateHook: FieldHook = ({ data, value }) => {
  if (data?.proxyVotingDate) {
    return value
  }
  if (data?.meetingDate) {
    const meetingDate = new Date(data?.meetingDate)
    if (data?.type === 'אג"ח') {
      return getTwoHoursBeforeWithinWorkingHours(meetingDate)
    } else {
      return getWorkingDateBefore(meetingDate, 2, 12)
    }
  }

  return value
}
