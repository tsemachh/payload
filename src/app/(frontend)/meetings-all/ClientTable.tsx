'use client'

import { useState, useEffect } from 'react'
import { meetingColumns, renderMeetingActions } from '../meetings-future/meetingTableConstants'
import { DataTableServer } from '@/components/data-table-server'
import { MeetingTableDataType } from '../types/meetings'

export function MeetingsTableClient() {
  const [data, setData] = useState<MeetingTableDataType[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [pageSize, setPageSize] = useState<number>(25)

  // Fetch initial data when component mounts
  useEffect(() => {
    fetchData(1)
  }, [])

  // Fetch data with current filters, sort, and search
  const fetchData = async (page: number, term?: string, newPageSize?: number) => {
    setIsLoading(true)
    try {
      // Use the provided term if available, otherwise use the searchTerm state
      const searchValue = term !== undefined ? term : searchTerm
      // Use the provided pageSize if available, otherwise use the pageSize state
      const pageSizeValue = newPageSize !== undefined ? newPageSize : pageSize
      const response = await fetch(
        `/api/meetings-all?page=${page}&pageSize=${pageSizeValue}&sortField=${sortField}&sortDirection=${sortDirection}&search=${encodeURIComponent(searchValue)}`,
      )
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      const result = await response.json()
      setData(result.data)
      setTotalItems(result.totalItems)
      setTotalPages(result.totalPages)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = async (page: number) => {
    await fetchData(page)
  }

  const handleSort = async (field: string) => {
    // If clicking the same field, toggle direction, otherwise set to asc
    const newDirection = field === sortField ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'

    setSortField(field)
    setSortDirection(newDirection)
    await fetchData(currentPage)
  }

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    // Use the new term directly in the API call instead of relying on state update
    await fetchData(1, term) // Reset to first page on new search
  }

  const handlePageSizeChange = async (newPageSize: number) => {
    setPageSize(newPageSize)
    // Pass the new pageSize directly to fetchData to ensure it's used immediately
    await fetchData(1, undefined, newPageSize) // Reset to first page on page size change
  }

  return (
    <DataTableServer
      data={data}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={sortField as keyof MeetingTableDataType}
      defaultSortDirection={sortDirection}
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pagination={{
        pageSize,
        totalItems,
        totalPages,
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
