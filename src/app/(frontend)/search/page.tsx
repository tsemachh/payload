"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/data-table"

// Mock search function
const searchAll = async (query: string) => {
  // In a real application, this would search across all your data sources
  return [
    { id: 1, type: "assembly", company: "Company A", date: "2025-02-15" },
    { id: 2, type: "participation", company: "Company B", date: "2025-01-10" },
    { id: 3, type: "holding", company: "Company C", quantity: 1000 },
  ]
}

const columns = [
  { accessorKey: "type", header: "Type" },
  { accessorKey: "company", header: "Company" },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "quantity", header: "Quantity" },
]

export default function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q")
  const [results, setResults] = useState([])

  useEffect(() => {
    if (query) {
      searchAll(query).then(setResults)
    }
  }, [query])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search Results for "{query}"</h1>
      <DataTable columns={columns} data={results} />
    </div>
  )
}

