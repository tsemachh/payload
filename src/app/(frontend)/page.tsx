import { Suspense } from 'react'
import { DataTable } from '@/components/data-table'
import { fetchMeetingsForTable } from './api/payload'
import LoadingSpinnerDiamond from '@/components/ui/loading-spinner-diamond'

async function MeetingsTable() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  return <DataTable data={futureMeetingTableData} />
}

export default function AssembliesPage() {
  return (
    <div className="space-y-4 flex flex-col">
      <h1 className="text-2xl font-bold text-center">אסיפות</h1>
      <Suspense
        fallback={
          <div className="flex flex-col min-h-[500px] items-center justify-center">
            <LoadingSpinnerDiamond />
            <p className="text-center">טוען נתונים...</p>
          </div>
        }
      >
        <MeetingsTable />
      </Suspense>
    </div>
  )
}
