'use client'

import { BooleanIcon } from '@/components/ui/icons'
import { formatDateTime } from '../helpers/utils'
import { FutureMeetingTableData } from '../types'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'
import { Column } from '@/components/data-table'

export const meetingColumns: Column<FutureMeetingTableData>[] = [
  { key: 'stockNumber', header: 'מס׳ נייר', type: 'string' },
  { key: 'stockType', header: 'סוג נייר', type: 'string', filterable: true },
  { key: 'stockSymbol', header: 'סימול', type: 'string' },
  { key: 'stockName', header: 'שם נייר ערך', type: 'string' },
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
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
        row.marketValue / 1_000_000,
      ),
  },
  {
    key: 'registeredValue',
    header: 'ערך נקוב',
    type: 'number',
  },
  { key: 'meetingType', header: 'סוג', type: 'string', filterable: true },
  {
    key: 'meetingDate',
    header: 'מועד האסיפה',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.meetingDate)
    },
  },
  { key: 'reference', header: 'אסמכתא', type: 'string' },
  {
    key: 'meetingState',
    header: 'מצב',
    type: 'string',
    filterable: true,
    render: (row) =>
      meetingStateMap[row.meetingState as Exclude<MeetingState, null>] || row.meetingState,
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

export const renderMeetingActions = (row: FutureMeetingTableData) => {
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
