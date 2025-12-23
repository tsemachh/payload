'use client'

import { BooleanIcon, MultipleDocumentsIcon, SingleDocumentIcon } from '@/components/ui/icons'
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
import { VotingStatusCell } from '../components/VotingStatusCell'
import { formatNumberWithLocale } from '@/utils/numberUtils'
import { toggleAllCompanies, toggleAllAgendas } from './renderExpandableCell'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { LabelsIcon } from '../components/labels-icon'

// Function to create expand all header for companies
const createCompaniesExpandHeader = (
  companiesExpandedRows: Record<string, boolean>,
  setCompaniesExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  data: MeetingTableDataType[],
) => {
  const allMeetingIds = data.map((row) => row.meetingId)
  const allExpanded = allMeetingIds.every((id) => companiesExpandedRows[id])

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          toggleAllCompanies(
            data,
            companiesExpandedRows,
            setCompaniesExpandedRows,
            setFundsExpandedRows,
          )
        }}
        title={allExpanded ? 'סגור את כל החברות' : 'פתח את כל החברות'}
      >
        {allExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
      <span>חברות</span>
    </div>
  )
}

// Function to create expand all header for agendas
const createAgendasExpandHeader = (
  agendasExpandedRows: Record<string, boolean>,
  setAgendasExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  data: MeetingTableDataType[],
) => {
  const allMeetingIds = data.map((row) => row.meetingId)
  const allExpanded = allMeetingIds.every((id) => agendasExpandedRows[id])

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          toggleAllAgendas(data, agendasExpandedRows, setAgendasExpandedRows)
        }}
        title={allExpanded ? 'סגור את כל סדרי היום' : 'פתח את כל סדרי היום'}
      >
        {allExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
      <span>סדר יום</span>
    </div>
  )
}

export const createMeetingColumns = (
  companiesExpandedRows: Record<string, boolean>,
  setCompaniesExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  agendasExpandedRows: Record<string, boolean> | undefined,
  setAgendasExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>> | undefined,
  data: MeetingTableDataType[] = [],
): Column<MeetingTableDataType>[] => [
  {
    key: 'information',
    header: 'מידע על ההצבעה',
    noHeader: true,
    type: 'other',
    isAlwaysVisible: true,
    positionCenter: true,
    render: (row) => {
      return <AgendaTooltipWithNavigation row={row} />
    },
    minWidth: 30,
  },
  {
    key: 'companies',
    header: 'חברות',
    type: 'string',
    sortKey: 'companies',
    isAlwaysVisible: true,
    minWidth: 50,
    width: 80,
    renderHeader: () =>
      createCompaniesExpandHeader(
        companiesExpandedRows,
        setCompaniesExpandedRows,
        setFundsExpandedRows,
        data,
      ),
  },
  {
    key: 'agenda',
    header: 'סדר יום',
    type: 'string',
    sortKey: 'agendas',
    isAlwaysVisible: true,
    minWidth: 80,
    width: 80,
    renderHeader: () =>
      agendasExpandedRows && setAgendasExpandedRows
        ? createAgendasExpandHeader(agendasExpandedRows, setAgendasExpandedRows, data)
        : 'סדר יום',
  },
  {
    key: 'labels',
    header: 'תגיות',
    type: 'label',
    filterable: true,
    render: (row) => <LabelsIcon row={row} />,
    minWidth: 90,
  },
  {
    key: 'stockNumber',
    header: 'מס׳ נייר',
    type: 'string',
    sortKey: 'stockNumber',
    minWidth: 100,
  },
  {
    key: 'stockType',
    header: 'סוג נייר',
    type: 'enum',
    filterable: true,
    options: stockTypeOptions,
    minWidth: 90,
  },
  { key: 'stockName', header: 'שם נייר', type: 'string', minWidth: 130 },
  { key: 'companyName', header: 'שם תאגיד', type: 'string', minWidth: 130 },
  { key: 'stockSymbol', header: 'סימול', type: 'string', minWidth: 100 },
  {
    key: 'stockTradable',
    header: 'נייר ערך נסחר',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.stockTradable} showX={false} />,
    minWidth: 70,
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
    header: 'שווי שוק \n (מיליוני ₪)',
    type: 'number',
    render: (row) => {
      const marketValue = parseNumber(row.marketValue)
      return formatNumberWithLocale(marketValue / 1_000_000, 0, 'he-IL')
    },
    minWidth: 140,
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
    key: 'nominalValueClientReported',
    header: 'ערך נקוב מדווח ',
    type: 'number',
    render: (row) => {
      const mismatch = row.nominalValue !== row.nominalValueClientReported
      return (
        <span className={mismatch ? 'text-red-600' : ''}>
          {formatNumberWithLocale(row.nominalValueClientReported, 0, 'he-IL')}
        </span>
      )
    },
    minWidth: 90,
  },
  {
    key: 'nominalValue',
    header: 'ערך נקוב בפועל',
    type: 'number',
    render: (row) => {
      const mismatch = row.nominalValue !== row.nominalValueClientReported
      return (
        <span className={mismatch ? 'text-red-600' : ''}>
          {formatNumberWithLocale(row.nominalValue, 0, 'he-IL')}
        </span>
      )
    },
    minWidth: 90,
  },
  {
    key: 'percentageHolding',
    header: 'החזקה (%)',
    type: 'number',
    render: (row) => formatNumberWithLocale(row.percentageHolding, 4, 'he-IL'),
    minWidth: 100,
  },
  {
    key: 'holdingValueInMillions',
    header: 'שווי החזקה  (מיליוני ₪)',
    type: 'number',
    render: (row) => formatNumberWithLocale(row.holdingValueInMillions, 0, 'he-IL'),
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
    key: 'fromRelatedStock',
    header: 'ניירות עוקבים',
    type: 'boolean',
    filterable: true,
    render: (row) => <BooleanIcon iconType={Boolean(row.fromRelatedStock)} showX={false} />,
    minWidth: 90,
  },
  {
    key: 'isDualStock',
    header: 'אסיפה דואלית',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.isDualStock} showX={false} />,
    minWidth: 70,
  },
  {
    key: 'reported',
    header: 'הצבעה בפועל',
    type: 'boolean',
    positionCenter: true,
    render: (row) => <VotingStatusCell row={row} />,
    minWidth: 50,
  },
  {
    key: 'votingPercentage',
    header: 'הצבעות התקבלו בעמדה',
    type: 'boolean',
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.votingPercentage === 100} showX={false} />,
    minWidth: 80,
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
    render: (row) => <BooleanIcon iconType={row.resultsConfirmationStatus} showX={false} />,
    minWidth: 70,
  },
  {
    key: 'electronicVotingEnabled',
    header: 'מופיעה במערכת האלק׳',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.electronicVotingEnabled} />,
    minWidth: 80,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.committeeInitiated} showX={false} />,
    minWidth: 70,
  },
]

// Legacy export for backward compatibility
export const meetingColumns: Column<MeetingTableDataType>[] = createMeetingColumns(
  {},
  () => {},
  () => {},
  {},
  () => {},
  [],
)
export const defaultVisibleColumns = [
  'information',
  'companies',
  'agenda',
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
