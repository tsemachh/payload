import { MeetingState, StockOrigin } from '@/payload-types'

export const meetingStateMap: Record<Exclude<MeetingState, null>, string> = {
  scheduled: 'מתוכננת',
  completed: 'התקיימה',
  postponed: 'נדחית',
  'on-hold': 'נדחית ללא מועד',
  ongoing: 'נמשכת',
  cancelled: 'בוטלה',
}

export const stockOriginMap: Record<Exclude<StockOrigin, null>, string> = {
  TASE: 'בורסה',
  Foreign:'חו״ל',
  Private: 'פרטי',
}

export const colorClasses: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  gray: 'bg-gray-500',
  black: 'bg-black',
}
