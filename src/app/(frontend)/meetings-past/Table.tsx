import { fetchMeetingsForTable } from '../api/payload'
import { MeetingsTablePastClient } from './ClientTable'

export async function MeetingsTablePast() {
  const { data: futureMeetingTableData, totalItems, totalPages } = await fetchMeetingsForTable(1, 25)

  return (
    <MeetingsTablePastClient 
      initialData={futureMeetingTableData}
      initialTotalItems={totalItems}
      initialTotalPages={totalPages}
    />
  )
}
