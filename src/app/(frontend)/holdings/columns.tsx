"use client"

import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"
import { Holding } from "./types"

import { Column } from '../types/meetings'

export const columns: Column<Holding>[] = [
  {
    key: 'company',
    header: 'חברה',
    type: 'string',
    minWidth: 150,
    width:350,
    filterable: true,
  },
  {
    key: 'stockNumber',
    header: 'מספר נייר ערך',
    type: 'string',
    minWidth: 120,
    width:100,
    filterable: true,
  },
  {
    key: 'quantity',
    header: 'כמות',
    type: 'number',
    minWidth: 100,
    width:100,
    filterable: false,
    render: (row) => (
      <span className="text-right">{row.quantity.toLocaleString()}</span>
    ),
  },
  {
    key: 'lastUpdated',
    header: 'עדכון אחרון',
    type: 'datetime',
    minWidth: 150,
    width:200,
    filterable: true,
  },
]

