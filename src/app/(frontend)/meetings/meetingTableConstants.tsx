'use client'

import { BooleanIcon } from '@/components/ui/icons'
import { formatDateTime } from '../helpers/utils'
import { MeetingTableDataType } from '../types'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'
import { Column } from '@/app/(frontend)/components/data-table-dynamic'
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns'

export const meetingColumns: Column<MeetingTableDataType>[] = [
  { key: 'stockNumber', header: 'מס׳ נייר', type: 'string', sortKey: 'stockNumber' },
  {
    key: 'stockType',
    header: 'סוג נייר',
    type: 'enum',
    filterable: true,
    options: [
      { label: 'מניות', value: 'מניות' },
      { label: 'אופציות', value: 'אופציות' },
      { label: 'איגרות חוב', value: 'איגרות חוב' },
      { label: 'איגרות חוב להמרה', value: 'איגרות חוב להמרה' },
      { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
      { label: 'תעודות מדד', value: 'תעודות מדד' },
      { label: 'תעודות סל', value: 'תעודות סל' },
      { label: 'קרנות נאמנות', value: 'קרנות נאמנות' },
      { label: 'נייר ערך מסחרי', value: 'נייר ערך מסחרי' },
      { label: 'אחר', value: 'אחר' },
      { label: 'זכויות', value: 'זכויות' },
      { label: 'מק"מ', value: 'מק"מ' },
      { label: 'שטרי הון', value: 'שטרי הון' },
    ],
  },
  { key: 'stockName', header: 'שם נייר', type: 'string' },
  {
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    type: 'number',
    width: 80,
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        row.marketValue / 1_000_000,
      ),
  },
  { key: 'stockSymbol', header: 'סימול', type: 'string' },
  { key: 'companyName', header: 'שם חברה', type: 'string' },
  {
    key: 'stockTradable',
    header: 'נייר ערך נסחר',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.stockTradable} />,
  },

  {
    key: 'registeredValue',
    header: 'ערך נקוב',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(row.registeredValue / 1),
  },
  {
    key: 'meetingType',
    header: 'סוג אסיפה',
    type: 'enum',
    filterable: true,
    options: [
      { label: 'שנתית', value: 'שנתית' },
      { label: 'מיוחדת', value: 'מיוחדת' },
      { label: 'אג"ח', value: 'אג"ח' },
      { label: 'אופציה', value: 'אופציה' },
      { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
      { label: 'תעודת סל', value: 'תעודת סל' },
      { label: 'אג"ח כהונת נאמן', value: 'אג"ח כהונת נאמן' },
    ],
  },
  {
    key: 'meetingDate',
    header: 'מועד האסיפה',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.meetingDate)
    },
  },
  {
    key: 'holdingsLimit',
    header: 'מועד קובע',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.holdingsLimit, true)
    },
  },
  {
    key: 'proxyVotingDate',
    header: 'מועד מסירת הצבעות',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.proxyVotingDate)
    },
  },
  { key: 'reference', header: 'אסמכתא', type: 'string' },
  {
    key: 'meetingState',
    header: 'מצב',
    type: 'enum',
    filterable: true,
    options: [
      { label: 'מתוכננת', value: 'scheduled' },
      { label: 'התקיימה', value: 'completed' },
      { label: 'נדחית', value: 'postponed' },
      { label: 'נדחית ללא מועד', value: 'on-hold' },
      { label: 'נמשכת', value: 'ongoing' },
      { label: 'בוטלה', value: 'cancelled' },
    ],
    render: (row) =>
      meetingStateMap[row.meetingState as Exclude<MeetingState, null>] || row.meetingState,
  },
  { key: 'location', header: 'מיקום', type: 'string' },
  { key: 'comments', header: 'הערות', type: 'string' },
  {
    key: 'resultsConfirmationStatus',
    header: 'אימות תוצאות',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.resultsConfirmationStatus} />,
  },
  {
    key: 'electronicVotingEnabled',
    header: 'מופיעה במערכת האלק׳',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.electronicVotingEnabled} />,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.committeeInitiated} />,
  },
]

export const renderMeetingActions = (row: MeetingTableDataType) => {
  if (!row.meetingInviteUrl) return null

  return (
    <div className="relative flex items-center">
      <div className="absolute right-0 top-0 h-full bg-background opacity-0 group-hover:opacity-100 transition-all duration-200"></div>
      <span className="absolute right-[-100px] top-0 h-full w-[100px] opacity-0 group-hover:opacity-100 bg-gradient-to-r from-secondary z-20 transition-all duration-200"></span>
      <a
        href={row.meetingInviteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute h-[40px] overflow-hidden flex underlined-text decoration-2 items-center justify-center inset-0 inline w-[100px] group-hover:bg-secondary text-sm text-transparent group-hover:text-blue-600 group-hover:underline group-hover:decoration-2 whitespace-nowrap z-30 transition-all duration-200"
      >
        קישור למגנה
      </a>
      <div className="w-[100px] h-[40px] opacity-0 group-hover:opacity-100 bg-gradient-to-r from-secondary z-20 transition-all duration-200"></div>
    </div>
  )
}

export const getDateRange = (option: string): { start: Date; end: Date } => {
  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)

  switch (option) {
    case 'today':
      return { start: today, end: endOfDay(today) }
    case 'nextWeek':
      return { start: today, end: endOfDay(addDays(today, 7)) }
    case 'nextMonth':
      return { start: today, end: endOfDay(addDays(today, 30)) }
    case 'allFuture':
      return { start: today, end: new Date(8640000000000000) } // Max date
    case 'yesterday':
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) }
    case 'lastWeek':
      return { start: startOfDay(subDays(yesterday, 6)), end: endOfDay(yesterday) }
    case 'lastMonth':
      return { start: startOfDay(subDays(yesterday, 29)), end: endOfDay(yesterday) }
    case 'allPast':
      return { start: new Date(-8640000000000000), end: endOfDay(yesterday) } // Min date
    default:
      return { start: today, end: today }
  }
}

export const pastDateFilterOptions = [
  { value: 'yesterday', label: 'אתמול' },
  { value: 'lastWeek', label: 'שבוע שעבר' },
  { value: 'lastMonth', label: 'חודש שעבר' },
  { value: 'allPast', label: 'בעבר' },
]

export const futureDateFilterOptions = [
  { value: 'today', label: 'היום' },
  { value: 'nextWeek', label: 'השבוע' },
  { value: 'nextMonth', label: 'החודש' },
  { value: 'allFuture', label: 'בעתיד' },
]
