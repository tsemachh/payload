'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { DataTableServer } from '@/components/data-table-server'
import { meetingColumns, renderMeetingActions } from '../meetingTableConstants'
import { MeetingTableDataType } from '../../types/meetings'

export function MeetingsTableServer() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  const { data, isLoading } = useSWR(query, fetcher)

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
      data={data?.data || []}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={sortField as keyof MeetingTableDataType}
      defaultSortDirection={sortDirection}
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pagination={{
        pageSize,
        totalItems: data?.totalItems || 0,
        totalPages: data?.totalPages || 0,
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

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API error [api/meetings/all-meetings]: ${res.status} - ${errText}`)
  }
  return res.json()
}
