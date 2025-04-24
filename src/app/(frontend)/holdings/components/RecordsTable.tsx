'use client'

import React from 'react'
import { Column } from '../../types/meetings'
import { DataTableStatic } from '../../components/data-table-client'
import { HoldingFeedLine } from '@/payload-types'

// הגדרת הטיפוס עבור הרשומות
interface RecordType {
  lineNumber: string | number
  stockId: string | number
  accountId: string | number
  quantity: string | number
  id?: string | number // מזהה ייחודי לכל רשומה
}

// הגדרת העמודות בטבלה
const recordColumns: Column<RecordType>[] = [
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
    filterable: true,
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

// רשימת העמודות שיוצגו כברירת מחדל
const defaultVisibleRecordColumns = ['lineNumber', 'stockId', 'accountId', 'quantity']

export const RecordsTable: React.FC<{ records: HoldingFeedLine[] }> = ({ records }) => {
  const dataWithIds: RecordType[] = records.map((record, index) => ({
    id: index + 1,
    lineNumber: record.lineNumber ?? 'N/A',
    stockId: record.stockId ?? 'N/A',
    accountId: record.accountId ?? 'N/A',
    quantity: record.quantity ?? 'N/A',
  }))
  console.log('dataWithIds', dataWithIds)

  return (
    <div className="mb-6">
      <div className="max-w-6xl mx-auto">
        <DataTableStatic
          data={dataWithIds}
          columns={recordColumns}
          idField="id"
          defaultSortField="lineNumber"
          defaultSortDirection="asc"
          tableId="records-table"
          filterOption={false}
          defaultVisibleColumns={defaultVisibleRecordColumns}
        />
      </div>
    </div>
  )
}
