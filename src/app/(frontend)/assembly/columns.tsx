import { Column } from '../components/data-table'
import { FutureMeetingTableData } from '../types'
import { BooleanIcon } from '../components/ui/icons'
import { formatDateTime } from '../helpers/utils'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'

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
    header: 'מועד',
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
