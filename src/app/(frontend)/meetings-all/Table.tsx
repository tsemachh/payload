import { fetchMeetingsForTable } from '../api/meetings'
import { MeetingsTablePastClient } from './ClientTable'

export async function MeetingsTablePast() {
  const initialPageSize = 25
  const {
    data: futureMeetingTableData,
    totalItems,
    totalPages,
  } = await fetchMeetingsForTable(1, initialPageSize)

  return (
    <MeetingsTablePastClient
      initialData={futureMeetingTableData}
      initialTotalItems={totalItems}
      initialTotalPages={totalPages}
      initialPageSize={initialPageSize}
    />
  )
}
