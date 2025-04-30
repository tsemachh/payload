'use client'
import { Column } from '../../types/meetings'

export const columns: Column<any>[] = [
  {
    key: 'stockName',
    header: 'נייר ערך',
    type: 'string',
    minWidth: 120,
    width: 300,
    render: (row) => `${row.stockId ?? 'N/A'} - ${row.stockName ?? 'N/A'}`,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    minWidth: 60,
    width: 100,
    render: (row) => <span className="text-right">{row.quantity.toLocaleString()}</span>,
  },
  {
    key: 'company',
    header: 'חברה',
    type: 'string',
    filterable: true,
    minWidth: 120,
    width: 300,
  },
]
