import { MeetingState } from '@/payload-types'

export const meetingStateMap: Record<Exclude<MeetingState, null>, string> = {
  scheduled: 'מתוזמן',
  completed: 'הושלם',
  postponed: 'נדחה',
  'on-hold': 'בהמתנה',
  ongoing: 'מתקיים',
  cancelled: 'בוטל',
}
