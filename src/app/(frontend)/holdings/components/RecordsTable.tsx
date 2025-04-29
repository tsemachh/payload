'use client'

import React from 'react'
import { Column } from '../../types/meetings'
import { DataTableStatic } from '../../components/data-table-client'
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
    minWidth: 70,
  },
  {
    key: 'stockName',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 90,
    render: (row) => `${row.stockId ?? 'N/A'} - ${row.stockName ?? 'N/A'}`,
  },
  {
    key: 'accountId',
    header: 'חשבון',
    type: 'string',
    filterable: true,
    minWidth: 70,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    minWidth: 70,
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        Number(row.quantity) || 0,
      ),
  },
]
//silenced-stocks
const getInvalidColumnsAdditional = (companies: string[]): Column<RecordType>[] => [
  {
    key: 'error',
    header: 'שגיאה',
    type: 'string',
    minWidth: 150,
    filterable: true,
    render: (row) => {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{row.error}</span>
          {row.error === 'נייר ערך לא מוכר' && (
            <SilenceDialog stockId={row.stockId} companies={companies} />
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
}> = ({ records, invalid, companies }) => {
  const dataWithIds: RecordType[] = records.map((holding, index) => ({
    id: index + 1,
    lineNumber: holding.lineNumber ?? 'N/A',
    stockId: holding.stockId ?? 'N/A',
    stockName: holding.stockName ?? 'N/A',
    accountId: holding.accountId ?? 'N/A',
    quantity: holding.quantity ?? 'N/A',
    error: holding.error ?? ' ',
  }))

  const columns = invalid
    ? [...holdingColumns, ...getInvalidColumnsAdditional(companies)]
    : holdingColumns

  return (
    <div style={{ maxHeight: `${window.innerHeight - 300}px`, overflowY: 'auto' }}>
      <DataTableStatic
        data={dataWithIds}
        columns={columns}
        idField="id"
        defaultSortField="lineNumber"
        defaultSortDirection="asc"
        tableId={invalid ? 'holdings-table-invalid' : 'holdings-table'}
        columnsOption={false}
      />
    </div>
  )
}
