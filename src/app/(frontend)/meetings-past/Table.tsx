import { fetchMeetingsForTable } from '../api/payload'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from '../meetings/meetingTableConstants'
import { DataTableDynamic } from '../components/data-table-dynamic'

export async function MeetingsTablePast() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  return (
    <DataTableDynamic
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
