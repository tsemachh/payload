'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { DataTableServer } from '@/components/data-table-server'
import { meetingColumns, renderMeetingActions } from '../meetingTableConstants'
import { CompanyTableDate, MeetingTableDataType } from '../../types/meetings'
import { fetcher, postFetcher } from '../../helpers/utils-data-table'

export function MeetingsTableServer() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection,
      search: searchTerm,
    })
    return `/api/meetings/all-meetings?${params.toString()}`
  }, [currentPage, pageSize, sortField, sortDirection, searchTerm])

  const { data: meetingsResponse, isLoading } = useSWR(query, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1) // reset to first page
  }

  const handleSort = (field: string) => {
    const newDirection = field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1) // reset to first page
  }

  return (
    <DataTableServer
      data={dataWithPercentages}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={sortField as keyof MeetingTableDataType}
      defaultSortDirection={sortDirection}
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pagination={{
        pageSize,
        totalItems: meetingsResponse?.totalItems || 0,
        totalPages: meetingsResponse?.totalPages || 0,
        currentPage,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
        pageSizeOptions: [10, 25, 50, 100, 500, 1000],
      }}
      isLoading={isLoading}
      onServerSort={handleSort}
      onServerSearch={handleSearch}
      initialSearchTerm={searchTerm}
      searchPlaceholder="חיפוש בכל השדות..."
    />
  )
}
