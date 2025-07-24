'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { DataTableServer } from '@/components/data-table-server'
import { meetingColumns, renderMeetingActions } from '../meetingTableConstants'
import { CompanyTableDate, MeetingTableDataType } from '../../types/meetings'
import { fetcher, postFetcher } from '../../helpers/utils-data-table'
import { futureDateFilterOptions, pastDateFilterOptions } from '../filterConst'

export function MeetingsTableServer() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [dateFilters, setDateFilters] = useState<
    Record<string, { past: string; future: string; empty: boolean }>
  >({})

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: currentPage.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection,
      search: searchTerm,
    })

    // Add regular filters
    Object.entries(filters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        params.append(`filter_${key}`, JSON.stringify(values))
      }
    })

    // Add date filters
    Object.entries(dateFilters).forEach(([key, filter]) => {
      if (filter.past || filter.future || !filter.empty) {
        params.append(`dateFilter_${key}`, JSON.stringify(filter))
      }
    })

    return `/api/meetings/all-meetings?${params.toString()}`
  }, [currentPage, pageSize, sortField, sortDirection, searchTerm, filters, dateFilters])

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

  const handleFilter = (field: string, values: string[]) => {
    console.log('field', field, 'values', values)
    setFilters((prev) => ({
      ...prev,
      [field]: values,
    }))
    setCurrentPage(1) // reset to first page
  }

  const handleDateFilter = (
    field: string,
    filter: { past: string; future: string; empty: boolean },
  ) => {
    setDateFilters((prev) => ({
      ...prev,
      [field]: filter,
    }))
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
      onServerFilter={handleFilter}
      onServerDateFilter={handleDateFilter}
      initialSearchTerm={searchTerm}
      searchPlaceholder="חיפוש בשדות הטקסט והמספרים..."
      serverSideProcessing={true}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
    />
  )
}
