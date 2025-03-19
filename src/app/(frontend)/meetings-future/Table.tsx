import { fetchMeetingsForTable } from '../api/meetings'
import { MeetingsTableClient } from './ClientTable'

export async function MeetingsTableFuture() {
  const onlyFuture = true
  const { data: futureMeetingTableData } = await fetchMeetingsForTable(1, 0, onlyFuture)

  return <MeetingsTableClient initialData={futureMeetingTableData} onlyFuture={onlyFuture} />
}
