'use client'

import { useState, useEffect } from 'react'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from '../meetings/meetingTableConstants'
import { DataTableServer } from '../components/data-table-server'
import { MeetingTableDataType } from '../types'

export function MeetingsTablePastClient({
  initialData,
  initialTotalItems,
  initialTotalPages,
}: {
  initialData: MeetingTableDataType[]
  initialTotalItems: number
  initialTotalPages: number
}) {
  const [data, setData] = useState<MeetingTableDataType[]>(initialData)
  const [totalItems, setTotalItems] = useState(initialTotalItems)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const pageSize = 25

  // Fetch data with current filters, sort, and search
  const fetchData = async (page: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/meetings?page=${page}&pageSize=${pageSize}&sortField=${sortField}&sortDirection=${sortDirection}&search=${encodeURIComponent(searchTerm)}`,
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
    await fetchData(1) // Reset to first page on new search
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
      }}
      isLoading={isLoading}
      onServerSort={handleSort}
      onServerSearch={handleSearch}
      initialSearchTerm={searchTerm}
      searchPlaceholder="חיפוש בכל השדות..."
    />
  )
}
