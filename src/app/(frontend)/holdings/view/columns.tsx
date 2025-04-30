'use client'
import { Column } from '../../types/meetings'

export const columns: Column<any>[] = [
  {
    key: 'stockNumber',
    header: 'מספר נייר ערך',
    type: 'string',
    minWidth: 120,
    width: 100,
  },
  {
    key: 'stockName',
    header: 'שם נייר ערך',
    type: 'string',
    minWidth: 100,
    width: 130,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    minWidth: 100,
    width: 100,
    render: (row) => <span className="text-right">{row.quantity.toLocaleString()}</span>,
  },
  {
    key: 'company',
    header: 'חברה',
    type: 'string',
    filterable: true,
    minWidth: 150,
    width: 350,
  },
]
