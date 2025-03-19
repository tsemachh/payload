import { fetchMeetingsForTable } from '../api/payload'
import { MeetingsTableClient } from './ClientTable'

export async function MeetingsTableFuture() {
  const onlyFuture = true
  const { data: futureMeetingTableData } = await fetchMeetingsForTable(1, 0, onlyFuture)

  return <MeetingsTableClient initialData={futureMeetingTableData} onlyFuture={onlyFuture} />
}
