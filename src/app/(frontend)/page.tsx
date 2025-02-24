import { DataTable } from '@/components/data-table'
import { fetchMeetingsForTable } from './api/payload'

export default async function AssembliesPage() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  return (
    <div className="space-y-4 flex flex-col">
      <h1 className="text-2xl font-bold text-center">אסיפות</h1>
      <DataTable data={futureMeetingTableData} />
    </div>
  )
}
