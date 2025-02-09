"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { columns } from "./columns"
import { FileUpload } from "@/components/file-upload"
import { ExportButton } from "@/components/export-button"

const mockData = [
  {
    id: 1,
    company: "חברה פ",
    securityNumber: "1234567",
    quantity: 1000,
    lastUpdated: "2025-02-10",
  },
  {
    id: 2,
    company: "חברה ק",
    securityNumber: "7654321",
    quantity: 500,
    lastUpdated: "2025-02-09",
  },
  {
    id: 3,
    company: "חברה ר",
    securityNumber: "9876543",
    quantity: 750,
    lastUpdated: "2025-02-08",
  },
]

export default function Holdings() {
  const [holdings, setHoldings] = useState(mockData)

  const handleFileUpload = (data: any[]) => {
    // In a real application, you would process the data and update your database
    setHoldings([...holdings, ...data])
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">החזקות</h1>
      <div className="flex justify-between items-center">
        <FileUpload onUpload={handleFileUpload} />
        <ExportButton data={holdings} filename="holdings" />
      </div>
      <DataTable columns={columns} data={holdings} />
    </div>
  )
}

