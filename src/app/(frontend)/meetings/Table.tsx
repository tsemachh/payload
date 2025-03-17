import { fetchMeetingsForTable } from '../api/payload'
import { MeetingsTableClient } from './ClientTable'

export async function MeetingsTableFuture() {
  const onlyFuture = true
  const {
    data: futureMeetingTableData,
    totalItems,
    totalPages,
  } = await fetchMeetingsForTable(1, 1000, onlyFuture)

  return (
    <MeetingsTableClient
      initialData={futureMeetingTableData}
      initialTotalItems={totalItems}
      initialTotalPages={totalPages}
      onlyFuture={onlyFuture}
    />
  )
}
