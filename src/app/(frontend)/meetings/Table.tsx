import { DataTableStatic } from '@/app/(frontend)/components/data-table-static'
import { fetchMeetingsForTable } from '../api/payload'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from './meetingTableConstants'

export async function MeetingsTable() {
  const futureMeetingTableData = await fetchMeetingsForTable()

  return (
    <DataTableStatic
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
