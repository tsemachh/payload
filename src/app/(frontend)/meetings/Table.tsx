import { fetchMeetingsForTable } from '../api/payload'
import { MeetingsTableClient } from './ClientTable'

export async function MeetingsTable() {
  const { data: futureMeetingTableData, totalItems, totalPages } = await fetchMeetingsForTable(1, 25)

  return (
    <MeetingsTableClient 
      initialData={futureMeetingTableData}
      initialTotalItems={totalItems}
      initialTotalPages={totalPages}
    />
  )
}
