import { MeetingState } from '@/payload-types'

export const meetingStateMap: Record<Exclude<MeetingState, null>, string> = {
  scheduled: 'מתוכננת',
  completed: 'התקיימה',
  postponed: 'נדחית',
  'on-hold': 'נדחית ללא מועד',
  ongoing: 'נמשכת',
  cancelled: 'בוטלה',
}
