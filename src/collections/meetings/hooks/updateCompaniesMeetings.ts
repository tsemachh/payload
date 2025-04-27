import { PayloadRequest } from 'payload'
import { processCompaniesMeetings } from '../../companies-meetings/utils/processCompaniesMeetings'
import type { Meeting } from '@/payload-types'
import { FieldHook } from 'payload'
import Holidays from 'date-holidays'

/**
 * Update companies-meetings collection when a meeting is created or updated
 * This function processes the companies-meetings collection for the specific meeting
 *
 * @param req PayloadRequest object
 * @param meeting The meeting that was created or updated
 */
export const updateCompaniesMeetingsOnMeetingChange = async (
  req: PayloadRequest,
  meeting: Meeting,
): Promise<void> => {
  try {
    if (!meeting.stock || !meeting.holdingsLimit) {
      return
    }

    // Process companies-meetings for this specific meeting
    await processCompaniesMeetings(req, [meeting.id])

    req.payload.logger.info(`Updated companies-meetings for meeting ${meeting.id}`)
  } catch (error) {
    req.payload.logger.error(
      `Error updating companies-meetings for meeting: ${JSON.stringify(error)}`,
    )
  }
}
const hd = new Holidays('IL')
const isHolidayOrShabbat = (date: Date): boolean => {
  const holidays = hd.getHolidays(date.getFullYear())
  const isShabbat = date.getDay() === 5 || date.getDay() === 6
  const holiday = holidays.find((holiday) => {
    const holidayDate = new Date(holiday.start).toISOString().split('T')[0]
    const inputDate = date.toISOString().split('T')[0]
    return holidayDate === inputDate && holiday.type === 'public'
  })
  return holiday !== undefined || isShabbat
}

const getWorkingDateBefore = (date: Date, workingDaysBefore: number, hour: number): Date => {
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
  if (data?.meetingDate) {
    const meetingDate = new Date(data?.meetingDate)
    if (data?.type === 'אג"ח') {
      const holdingDate = getTwoHoursBeforeWithinWorkingHours(meetingDate)
      return holdingDate
    } else {
      const holdingDate = getWorkingDateBefore(meetingDate, 2, 12)
      return holdingDate
    }
  }

  return value
}
