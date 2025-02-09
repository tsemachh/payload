"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown } from "lucide-react"

export type Participation = {
  id: number
  company: string
  date: string
  type: string
  participation: string
  votingResult: string
}

export const columns: ColumnDef<Participation>[] = [
  {
    accessorKey: "company",
    header: "חברה",
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          תאריך
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "type",
    header: "סוג",
  },
  {
    accessorKey: "participation",
    header: "השתתפות",
  },
  {
    accessorKey: "votingResult",
    header: "תוצאת הצבעה",
  },
]

