import { fetchFutureMeetingsForTable } from '../api/payload'
import { MeetingsTableClient } from './ClientTable'

export async function MeetingsTableFuture() {
  const onlyFuture = true
  const { data: futureMeetingTableData } = await fetchFutureMeetingsForTable()

  return <MeetingsTableClient initialData={futureMeetingTableData} onlyFuture={onlyFuture} />
}
