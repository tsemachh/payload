'use client'

import { DataTable } from '@/components/data-table'
import { mockAssemblies } from './mockData'

export default function AssembliesPage() {
  console.log('mockAssemblies:', mockAssemblies)

  return (
    <div className="space-y-6">
      <h1
        className="text-2xl font-bold"
        onClick={() => console.log('mockAssemblies:', mockAssemblies)}
      >
        אסיפות עתידיות
      </h1>
      <DataTable data={mockAssemblies} />
    </div>
  )
}
