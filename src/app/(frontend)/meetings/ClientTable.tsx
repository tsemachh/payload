'use client'

import {
  defaultVisibleColumns,
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '@/components/data-table-client'
import { CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import useSWR from 'swr'
import { fetcher, postFetcher } from '../helpers/utils-data-table'
import { useMemo } from 'react'

export function MeetingsTableClient() {
  const { data: meetingsResponse, isLoading: isLoadingMeetings } = useSWR(
    `/api/meetings/future-meetings`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  )

  const meetingsForPercentagesQuery = useMemo(() => {
    if (!meetingsResponse?.data || meetingsResponse?.data.length === 0) {
      return null
    }

    const meetingsPayload = meetingsResponse?.data.map((meeting: MeetingTableDataType) => ({
      meetingId: meeting.meetingIdPayload,
      companyIds: meeting.companies.map((company: CompanyTableDate) => company.id),
    }))

    return { meetings: meetingsPayload }
  }, [meetingsResponse?.data])

  const swrKeyForPercentages = meetingsForPercentagesQuery
    ? ['/api/votes/voting-percentages', meetingsForPercentagesQuery]
    : null

  const { data: percentagesResponse } = useSWR(swrKeyForPercentages, postFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const votingPercentagesMap = percentagesResponse?.percentages

  const dataWithPercentages = useMemo(() => {
    if (!meetingsResponse?.data) return []

    if (!votingPercentagesMap) return meetingsResponse?.data

    return meetingsResponse?.data.map((meeting: MeetingTableDataType) => {
      const percentageData = votingPercentagesMap[meeting.meetingIdPayload]
      return {
        ...meeting,
        votingPercentage: percentageData ? percentageData.votingPercentage : null,
      }
    })
  }, [meetingsResponse?.data, votingPercentagesMap])

  return (
    <DataTableStatic
      data={dataWithPercentages}
      columns={meetingColumns}
      isLoading={isLoadingMeetings}
      idField="meetingId"
      defaultSortField={'meetingDate' as keyof MeetingTableDataType}
      defaultSortDirection="asc"
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
      onlyFuture={true}
      searchPlaceholder="חיפוש בכל השדות..."
      defaultVisibleColumns={defaultVisibleColumns}
      tableHeightOffset={200}
    />
  )
}
