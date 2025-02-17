import { DataTable } from '@/components/data-table'
import { fetchMeetingsForTable } from './api/payload'

export default async function AssembliesPage() {
  const futureMeetingTableData = await fetchMeetingsForTable()
  // const originalData = await fetchMeetingsForTable()
  // const futureMeetingTableData = [...originalData, ...originalData, ...originalData]

  return (
    <div className="space-y-6 flex flex-col items-center justify-center w-[100%]">
      <h1 className="text-2xl font-bold">אסיפות עתידיות</h1>
      <div className="max-w-full">
        <DataTable data={futureMeetingTableData} />
      </div>
    </div>
  )
}
