"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { columns } from "./columns"
import { ExportButton } from "@/components/export-button"

const mockData = [
  {
    id: 1,
    company: "חברה א",
    date: "2025-01-10",
    type: "שנתית",
    participation: "השתתף",
    votingResult: "אושר",
  },
  {
    id: 2,
    company: "חברה ב",
    date: "2025-01-15",
    type: "מיוחדת",
    participation: "לא השתתף",
    votingResult: "לא רלוונטי",
  },
  {
    id: 3,
    company: "חברה ג",
    date: "2025-01-20",
    type: "שנתית",
    participation: "השתתף",
    votingResult: "לא אושר",
  },
]

export default function Participations() {
  const [participations, setParticipations] = useState(mockData)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">השתתפויות</h1>
      <div className="flex justify-between items-center">
        <ExportButton data={participations} filename="participations" />
      </div>
{/*
      <DataTable columns={columns} data={participations} />
*/}
    </div>
  )
}

