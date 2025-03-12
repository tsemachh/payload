import { DataTable } from '@/app/(frontend)/components/data-table-static'
import { fetchMeetingsForTable } from '../api/payload'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from '../meetings/meetingTableConstants'

export async function MeetingsTable() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  return (
    <DataTable
      data={futureMeetingTableData}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField="meetingDate"
      defaultSortDirection="desc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
    />
  )
}
