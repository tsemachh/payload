'use client'

import React from 'react'
import { Column } from '../../types/meetings'
import { DataTableStatic } from '../../components/data-table-client'
import { HoldingFeedLine } from '@/payload-types'
import { SilenceDialog } from './SilenceDialog'
import { HoldingFeedLineWithName } from '@/collections/holdings/feeds/FeedValidations'

interface RecordType {
  lineNumber: string | number
  stockId: string | number
  accountId: string | number
  quantity: string | number
  error: string
  id?: string | number
  stockName: string
}

const holdingColumns: Column<RecordType>[] = [
  {
    key: 'lineNumber',
    header: 'שורה',
    type: 'string',
    minWidth: 50,
    width: 50,
  },
  {
    key: 'stockName',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 70,
    width: 130,
    render: (row) => `${row.stockId ?? 'N/A'} - ${row.stockName ?? 'N/A'}`,
  },
  {
    key: 'accountId',
    header: 'חשבון',
    type: 'string',
    filterable: true,
    minWidth: 60,
    width: 60,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    width: 60,
    minWidth: 60,
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        Number(row.quantity) || 0,
      ),
  },
]

const getInvalidColumnsAdditional = (companies: string[],allRecords:HoldingFeedLine[],onRefresh: (records: any[]) => void): Column<RecordType>[] => [
  {
    key: 'error',
    header: 'שגיאה',
    type: 'string',
    width: 100,
    minWidth: 120,
    filterable: true,
    render: (row) => {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{row.error}</span>
          {row.error === 'נייר ערך לא מוכר' && (
            <SilenceDialog stockId={row.stockId} companies={companies} allRecords={allRecords} onRefreshAction={onRefresh} />
          )}
        </div>
      )
    },
  },
]

export const RecordsTable: React.FC<{
  records: HoldingFeedLineWithName[]
  invalid?: boolean
  companies: string[]
  onRefresh?: (records: HoldingFeedLine[]) => void;
  valid?: HoldingFeedLine[]
  silenced?: HoldingFeedLine[]
}> = ({ records, invalid, companies,onRefresh,valid,silenced }) => {
  const dataWithIds: RecordType[] = records.map((holding, index) => ({
    id: index + 1,
    lineNumber: holding.lineNumber ?? 'N/A',
    stockId: holding.stockId ?? 'N/A',
    stockName: holding.stockName ?? 'N/A',
    accountId: holding.accountId ?? 'N/A',
    quantity: holding.quantity ?? 'N/A',
    error: holding.error ?? ' ',
  }))
  const allRecords = [
    ...records,
    ...(valid ?? []),
    ...(silenced ?? [])
  ]
  const columns = invalid && onRefresh
    ? [...holdingColumns, ...getInvalidColumnsAdditional(companies, allRecords, onRefresh)]
    : holdingColumns

  const tableWidth = columns.reduce((sum, column) => {
    return sum + (column.width || column.minWidth) + 25
  }, 0)

  return (
    <div
      style={{
        maxHeight: `${window.innerHeight - 300}px`,
        minWidth: tableWidth + 50 + 'px',
        maxWidth: tableWidth + 80 + columns.length * 100 + 'px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      <DataTableStatic
        data={dataWithIds}
        columns={columns}
        idField="id"
        defaultSortField="lineNumber"
        defaultSortDirection="asc"
        tableId={invalid ? 'holdings-table-invalid' : 'holdings-table'}
        columnsOption={false}
        tableHeightOffset={400}
      />
    </div>
  )
}
