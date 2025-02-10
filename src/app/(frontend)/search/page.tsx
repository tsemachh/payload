'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/data-table'
import { Meeting } from '@/payload-types'

const searchAll = async (query: string): Promise<Meeting[]> => {
  return [
    {
      id: '1',
      meetingId: 1,
      meetingDate: '2025-02-15',
      meetingType: 1, // השתמש במקום type
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      meetingId: 2,
      meetingDate: '2025-01-10',
      meetingType: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}

const columns = [
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'company', header: 'Company' },
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'quantity', header: 'Quantity' },
]

export default function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')
  const [results, setResults] = useState<Meeting[]>([])

  useEffect(() => {
    if (query) {
      searchAll(query).then(setResults)
    }
  }, [query])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search Results for &quot;{query}&quot;</h1>
      {/* <DataTable columns data={results} /> */}
      <DataTable data={results} />
    </div>
  )
}
