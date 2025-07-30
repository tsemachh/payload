'use client'

import { BooleanIcon, SingleDocumentIcon, MultipleDocumentsIcon } from '@/components/ui/icons'
import { formatDateTime, parseNumber } from '../helpers/utils-data-table'
import { Column, MeetingTableDataType } from '../types/meetings'
import { MeetingState, StockOrigin } from '@/payload-types'
import { meetingStateMap, stockOriginMap } from '../helpers/maps'
import { AgendaTooltipWithNavigation } from './AgendaTooltipWithNavigation'
import {
  meetingStateOptions,
  meetingTypeOptions,
  stockOriginOptions,
  stockTypeOptions,
} from './filtersConst'

export const meetingColumns: Column<MeetingTableDataType>[] = [
  {
    key: 'agendas',
    header: 'סדר היום',
    noHeader: true,
    type: 'other',
    isAlwaysVisible: true,
    positionCenter: true,
    render: (row) => {
      return <AgendaTooltipWithNavigation row={row} />
    },
    minWidth: 20,
  },
  {
    key: 'companies',
    header: 'חברות',
    type: 'string',
    sortKey: 'companies',
    minWidth: 50,
    width: 50,
    isAlwaysVisible: true,
  },
  {
    key: 'stockNumber',
    header: 'מס׳ נייר',
    type: 'string',
    sortKey: 'stockNumber',
    minWidth: 70,
  },
  {
    key: 'stockType',
    header: 'סוג נייר',
    type: 'enum',
    filterable: true,
    options: stockTypeOptions,
    minWidth: 60,
  },
  { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 100 },
  { key: 'companyName', header: 'שם חברה', type: 'string', minWidth: 120 },
  { key: 'stockSymbol', header: 'סימול', type: 'string', minWidth: 100 },
  {
    key: 'stockTradable',
    header: 'נייר ערך נסחר',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.stockTradable} />,
    minWidth: 40,
  },
  {
    key: 'stockOrigin',
    header: 'מקור נייר',
    type: 'enum',
    filterable: true,
    options: stockOriginOptions,
    render: (row) =>
      stockOriginMap[row.stockOrigin as Exclude<StockOrigin, null>] || row.stockOrigin,
    minWidth: 80,
  },
  {
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    type: 'number',
    render: (row) => {
      const marketValue = parseNumber(row.marketValue)
      return new Intl.NumberFormat('he-IL', {
        maximumFractionDigits: 0,
      }).format(marketValue / 1_000_000)
    },
    minWidth: 80,
  },
  {
    key: 'meetingType',
    header: 'סוג אסיפה',
    type: 'enum',
    filterable: true,
    options: meetingTypeOptions,
    minWidth: 80,
  },
  {
    key: 'meetingDate',
    header: 'מועד אסיפה',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.meetingDate)
    },
    minWidth: 130,
  },
  {
    key: 'holdingsLimit',
    header: 'מועד קובע',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.holdingsLimit, true)
    },
    minWidth: 120,
  },
  {
    key: 'proxyVotingDate',
    header: 'מועד מסירת הצבעות',
    type: 'datetime',
    filterable: true,
    render: (row) => {
      return formatDateTime(row.proxyVotingDate)
    },
    minWidth: 130,
  },
  {
    key: 'nominalValue',
    header: 'ערך נקוב ליום קובע',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(row.nominalValue),
    minWidth: 90,
  },
  {
    key: 'percentageHolding',
    header: 'אחזקה (%)',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(row.percentageHolding),
    minWidth: 100,
  },
  {
    key: 'holdingValueInMillions',
    header: 'שווי אחזקה  (מיליוני ₪)',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        row.holdingValueInMillions,
      ),
    minWidth: 90,
  },
  { key: 'reference', header: 'אסמכתא', type: 'string', minWidth: 120 },
  {
    key: 'meetingState',
    header: 'מצב',
    type: 'enum',
    filterable: true,
    options: meetingStateOptions,
    render: (row) =>
      meetingStateMap[row.meetingState as Exclude<MeetingState, null>] || row.meetingState,
    minWidth: 100,
  },
  {
    key: 'researchDocuments',
    header: 'מחקר',
    type: 'other',
    filterable: false,
    minWidth: 60,
    render: (row) => (
      <div className="flex gap-2">
        {row.researchDocuments.length > 0 && (
          <button
            onClick={() => {
              row.researchDocuments.forEach((doc) => {
                const link = document.createElement('a')
                link.href = doc.url
                link.download = doc.filename
                link.style.display = 'none'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              })
            }}
            title={
              row.researchDocuments.length === 1 ? 'Download document' : 'Download all documents'
            }
            className="group transition-transform hover:scale-110 hover:brightness-110 cursor-pointer"
          >
            {row.researchDocuments.length === 1 ? (
              <SingleDocumentIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
            ) : (
              <MultipleDocumentsIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
            )}
          </button>
        )}
      </div>
    ),
  },
  { key: 'location', header: 'מיקום', type: 'string', minWidth: 200 },
  { key: 'comments', header: 'הערות', type: 'string', minWidth: 120 },
  {
    key: 'resultsConfirmationStatus',
    header: 'אימות תוצאות',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.resultsConfirmationStatus} />,
    minWidth: 70,
  },
  {
    key: 'electronicVotingEnabled',
    header: 'מופיעה במערכת האלק׳',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.electronicVotingEnabled} />,
    minWidth: 70,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.committeeInitiated} />,
    minWidth: 70,
  },
]
export const defaultVisibleColumns = [
  'agendas',
  'companies',
  'stockNumber',
  'stockType',
  'stockName',
  'marketValue',
  'nominalValue',
  'percentageHolding',
  'holdingValueInMillions',
  'meetingType',
  'meetingDate',
  'holdingsLimit',
  'proxyVotingDate',
  'comments',
  'electronicVotingEnabled',
  'committeeInitiated',
  'researchDocuments',
]

export const unSortAbleColumnsOnServer = [
  'marketValue',
  'nominalValue',
  'percentageHolding',
  'holdingValueInMillions',
  'select',
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
        זימון לאסיפה
      </a>
      <div className="w-[100px] h-[40px] opacity-0 group-hover:opacity-100 bg-gradient-to-r from-secondary z-20 transition-all duration-200"></div>
    </div>
  )
}
