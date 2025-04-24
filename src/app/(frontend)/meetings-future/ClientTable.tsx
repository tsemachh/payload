'use client'

import {
  defaultVisibleColumns,
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import { MeetingTableDataType } from '../types/meetings'

export function MeetingsTableClient({
  initialData,
  onlyFuture,
}: {
  initialData: MeetingTableDataType[]
  onlyFuture?: boolean
}) {

  return (
    <DataTableStatic
      data={initialData}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={'meetingDate' as keyof MeetingTableDataType}
      defaultSortDirection="desc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
      onlyFuture={onlyFuture}
      searchPlaceholder="חיפוש בכל השדות..."
      defaultVisibleColumns={defaultVisibleColumns}
    />
  )
}
