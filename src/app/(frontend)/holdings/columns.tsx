"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

export type Holding = {
  id: number
  company: string
  stockNumber: string
  quantity: number
  lastUpdated: string
}

export const columns: ColumnDef<Holding>[] = [
  {
    accessorKey: 'company',
    header: 'חברה',
  },
  {
    accessorKey: 'stockNumber',
    header: 'מספר נייר ערך',
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          כמות
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: 'lastUpdated',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          עדכון אחרון
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      )
    },
  },
]

