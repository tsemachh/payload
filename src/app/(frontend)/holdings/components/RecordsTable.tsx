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
    minWidth: 50,
    width: 50,
  },
  {
    key: 'stockId',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 150,
    width: 150,
  },
  {
    key: 'accountId',
    header: 'חשבון',
    type: 'string',
    filterable: true,
    minWidth: 100,
    width: 100,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    width: 100,
    minWidth: 100,
    render: (row) =>
      new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(
        Number(row.quantity) || 0,
      ),
  },
]

const invalidColumnsAdditional = (companies: string[]): Column<RecordType>[] => [
  {
    key: 'error',
    header: 'שגיאה',
    type: 'string',
    width: 200,
    minWidth: 200,
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
  records: HoldingFeedLine[]
  invalid?: boolean
  companies: string[]
}> = ({ records, invalid, companies }) => {
  const dataWithIds: RecordType[] = records.map((holding, index) => ({
    id: index + 1,
    lineNumber: holding.lineNumber ?? 'N/A',
    stockId: holding.stockId ?? 'N/A',
    accountId: holding.accountId ?? 'N/A',
    quantity: holding.quantity ?? 'N/A',
    error: holding.error ?? ' ',
  }))

  const columns = invalid ? [...holdingColumns, ...invalidColumnsAdditional] : holdingColumns
  const tableWidth = columns.reduce((sum, column) => {
    return sum + (column.width || column.minWidth) + 25
  }, 0)

  return (
    <div
      style={{
        maxHeight: `${window.innerHeight - 300}px`,
        minWidth: tableWidth + 80 + 'px',
        maxWidth: tableWidth + 80 + columns.length * 40 + 'px',
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
