'use client'

import React from 'react'
import { Column } from '../../types/meetings'
import { DataTableStatic } from '../../components/data-table-client'
import { HoldingFeedLine } from '@/payload-types'
import { SilenceDialog } from './SilenceDialog'

interface RecordType {
  lineNumber: string | number
  stockId: string | number
  accountId: string | number
  quantity: string | number
  error: string
  id?: string | number
}

const holdingColumns: Column<RecordType>[] = [
  {
    key: 'lineNumber',
    header: 'שורה',
    type: 'string',
    minWidth: 70,
  },
  {
    key: 'stockId',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 70,
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
const invalidColumnsAdditional: Column<RecordType>[] = [
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
            <SilenceDialog stockId={row.stockId} lineNumber={row.lineNumber} />
          )}
        </div>
      )
    },
  },
];


const defaultVisibleValidgColumns = ['lineNumber', 'stockId', 'quantity']
const defaultVisibleInvalidColumnsA = [...defaultVisibleValidgColumns, 'error']

export const RecordsTable: React.FC<{ records: HoldingFeedLine[]; invalid?: boolean }> = ({
  records,
  invalid,
}) => {
  const dataWithIds: RecordType[] = records.map((holding, index) => ({
    id: index + 1,
    lineNumber: holding.lineNumber ?? 'N/A',
    stockId: holding.stockId ?? 'N/A',
    accountId: holding.accountId ?? 'N/A',
    quantity: holding.quantity ?? 'N/A',
    error: holding.error ?? ' ',
  }))

  const columns = invalid ? [...holdingColumns, ...invalidColumnsAdditional] : holdingColumns
  const defaultVisibleColumns = invalid
    ? defaultVisibleInvalidColumnsA
    : defaultVisibleValidgColumns

  return (
    <div style={{ maxHeight: `${window.innerHeight - 300}px`, overflowY: 'auto' }}>
      <DataTableStatic
        data={dataWithIds}
        columns={columns}
        idField="id"
        defaultSortField="lineNumber"
        defaultSortDirection="asc"
        tableId={invalid ? 'holdings-table-invalid' : 'holdings-table'}
        defaultVisibleColumns={defaultVisibleColumns}
      />
    </div>
  )
}
