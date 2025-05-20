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
import useSWR from 'swr'
import { fetcher } from '../helpers/utils-data-table'

export function MeetingsTableClient() {
  const { data, isLoading } = useSWR(`/api/meetings/future-meetings`, fetcher)

  return (
    <DataTableStatic
      data={data?.data || []}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={'meetingDate' as keyof MeetingTableDataType}
      defaultSortDirection="desc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
      onlyFuture={true}
      searchPlaceholder="חיפוש בכל השדות..."
      defaultVisibleColumns={defaultVisibleColumns}
      tableHeightOffset={200}
      isLoading={isLoading}
    />
  )
}
