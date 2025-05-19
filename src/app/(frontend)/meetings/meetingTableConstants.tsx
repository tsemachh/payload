'use client'

import { BooleanIcon } from '@/components/ui/icons'
import { formatDateTime, isRTL, parseNumber } from '../helpers/utils-data-table'
import { AgendasType, Column, MeetingTableDataType } from '../types/meetings'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

function AgendaTooltipWithNavigation({ row }: { row: MeetingTableDataType }) {
  const router = useRouter()

  const handleIconClick = (e: any) => {
    // Stop propagation to prevent the tooltip from interfering
    e.stopPropagation()
    const payload = {
      meeting: row,
    }
    const json = JSON.stringify(payload)
    const encoded = btoa(unescape(encodeURIComponent(json)))
    router.push(`/vote?data=${encodeURIComponent(encoded)}`)
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className="w-4 h-4 text-blue-700 hover:text-blue-800 cursor-pointer"
            onClick={handleIconClick}
          />
        </TooltipTrigger>
        <TooltipContent
          className="rounded-md shadow-md border border-gray-200"
          side="left"
          sideOffset={30}
          align="end"
          alignOffset={30}
          avoidCollisions={true}
          collisionPadding={30}
        >
          <div
            style={{
              maxWidth: 'min(800px, calc(100vw - 240px))',
              maxHeight: 'calc(100vh - 140px)',
              overflow: 'auto',
              direction: 'rtl',
            }}
            className="flex flex-col gap-2"
          >
            {/* Vote Status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${Number.parseInt(row.meetingId) % 2 === 0 ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <span className="font-medium text-sm px-2">
                {Number.parseInt(row.meetingId) % 2 === 0
                  ? 'ההצבעות התקבלו בעמדה'
                  : 'ההצבעות טרם התקבלו בעמדה'}
              </span>
            </div>

            {/* Comments Section */}
            {row.comments && row.comments != '-' && (
              <div className="mt-1 text-right">
                <h4 className="font-bold text-base mb-1 text-right">הערות</h4>
                <p className="text-sm bg-gray-50 p-2 rounded-md text-right">{row.comments}</p>
              </div>
            )}

            {/* Agenda Items Table */}
            <div className="mt-1">
              <h4 className="font-bold text-base mb-1 text-right">נושאים לסדר היום</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                  <tbody>
                    {row.agendas.length ? (
                      row.agendas.map((item: AgendasType, index: number) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td
                            className="py-1 px-2 border-t text-right "
                            style={{ width: '30px', minWidth: '30px' }}
                          >
                            {index + 1}.
                          </td>
                          <td
                            className={`py-1 px-2 border-t ${isRTL(item.text) ? 'text-right' : 'text-left'}`}
                          >
                            <div
                              dir={isRTL(item.text) ? 'ltr' : 'ltr'}
                              style={{
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'break-word',
                                fontSize: '0.80rem',
                              }}
                            >
                              {item.text}
                            </div>
                          </td>
                          <td
                            className="py-1 px-2 border-t text-right text-green-600 font-medium"
                            style={{ width: '80px', minWidth: '80px' }}
                          >
                            בעד
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-1 px-2 text-center">
                          אסיפה ללא נושא
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const meetingColumns: Column<MeetingTableDataType>[] = [
  {
    key: 'agendas',
    header: 'סדר היום',
    noHeader: true,
    type: 'other',
    filterable: true,
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
  { key: 'stockNumber', header: 'מס׳ נייר', type: 'string', sortKey: 'stockNumber', minWidth: 70 },
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
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    type: 'number',
    render: (row) => {
      const marketValue = parseNumber(row.marketValue)

      return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        marketValue / 1_000_000,
      )
    },
    minWidth: 70,
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
    minWidth: 60,
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
    header: 'שווי אחזקה (מיליוני)',
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
    minWidth: 50,
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
    minWidth: 50,
  },
  {
    key: 'electronicVotingEnabled',
    header: 'מופיעה במערכת האלק׳',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.electronicVotingEnabled} />,
    minWidth: 50,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.committeeInitiated} />,
    minWidth: 50,
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
]

export const unSortAbleColumnsOnServer = [
  'marketValue',
  'nominalValue',
  'percentageHolding',
  'holdingValueInMillions',
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
