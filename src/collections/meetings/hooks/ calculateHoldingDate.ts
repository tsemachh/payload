import { FieldHook } from 'payload'
import Holidays from 'date-holidays'

const hd = new Holidays('IL')
export const isHolidayOrShabbat = (date: Date): boolean => {
  const holidays = hd.getHolidays(date.getFullYear())
  const isShabbat = date.getDay() === 5 || date.getDay() === 6
  const holiday = holidays.find((holiday) => {
    const holidayDate = new Date(holiday.date).toISOString().split('T')[0]
    const inputDate = date.toISOString().split('T')[0]
    return holidayDate === inputDate && holiday.type === 'public'
  })
  return holiday !== undefined || isShabbat
}

export const getWorkingDateBefore = (date: Date, workingDaysBefore: number, hour: number): Date => {
  const result = new Date(date)
  result.setHours(hour, 0, 0, 0)

  let daysLeft = workingDaysBefore
  while (daysLeft > 0) {
    result.setDate(result.getDate() - 1)
    if (!isHolidayOrShabbat(result)) {
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
    if (!isHolidayOrShabbat(result)) {
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
    while (isHolidayOrShabbat(result)) {
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
