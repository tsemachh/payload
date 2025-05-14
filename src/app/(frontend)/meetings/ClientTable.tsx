'use client'

import {
  defaultVisibleColumns,
  futureDateFilterOptions,
  futuredefaultVisibleExtra,
  futureMeetingColumnsExtra,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import { MeetingTableDataType } from '../types/meetings'
import { useEffect, useState } from 'react'

export function MeetingsTableClient() {
  const [data, setData] = useState<MeetingTableDataType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Fetch initial data when component mounts
  useEffect(() => {
    fetchData()
  }, [])

  // Fetch data with current filters, sort, and search
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/meetings/future-meetings`)
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DataTableStatic
      data={data}
      columns={[...futureMeetingColumnsExtra, ...meetingColumns]}
      idField="meetingId"
      defaultSortField={'meetingDate' as keyof MeetingTableDataType}
      defaultSortDirection="desc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
      onlyFuture={true}
      searchPlaceholder="חיפוש בכל השדות..."
      defaultVisibleColumns={[...futuredefaultVisibleExtra, ...defaultVisibleColumns]}
      tableHeightOffset={200}
      isLoading={isLoading}
    />
  )
}
