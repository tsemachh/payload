import { DataTable } from '@/components/data-table'
import { fetchMeetingsForTable } from '../api/payload'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from '../meeting/meetingTableConstants'

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
