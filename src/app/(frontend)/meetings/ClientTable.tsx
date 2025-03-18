'use client'

import { useState, useEffect } from 'react'
import {
  futureDateFilterOptions,
  meetingColumns,
  pastDateFilterOptions,
  renderMeetingActions,
} from './meetingTableConstants'
import { DataTableStatic } from '../components/data-table-static'
import { MeetingTableDataType } from '../types/meetings'

export function MeetingsTableClient({
  initialData,
  initialTotalItems,
  initialTotalPages,
  onlyFuture,
}: {
  initialData: MeetingTableDataType[]
  initialTotalItems: number
  initialTotalPages: number
  onlyFuture?: boolean
}) {
  const [data, setData] = useState<MeetingTableDataType[]>(initialData)
  const [totalItems, setTotalItems] = useState(initialTotalItems)
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [sortField, setSortField] = useState<string>('meetingDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})
  const [facetData, setFacetData] = useState<Record<string, Record<string, number>>>({})
  const [isFacetLoading, setIsFacetLoading] = useState(false)
  const pageSize = 1000

  // Fetch facet data
  const fetchFacetData = async () => {
    setIsFacetLoading(true)
    try {
      const filtersParam = encodeURIComponent(JSON.stringify(filters))
      const response = await fetch(
        `/api/meetings?facetsOnly=true&filters=${filtersParam}&search=${encodeURIComponent(searchTerm)}`,
      )
      if (!response.ok) {
        throw new Error('Failed to fetch facet data')
      }
      const result = await response.json()
      setFacetData(result.facets)
    } catch (error) {
      console.error('Error fetching facet data:', error)
    } finally {
      setIsFacetLoading(false)
    }
  }

  // Fetch data with current filters, sort, and search
  const fetchData = async (page: number) => {
    setIsLoading(true)
    try {
      const filtersParam = encodeURIComponent(JSON.stringify(filters))
      const response = await fetch(
        `/api/meetings?page=${page}&pageSize=${pageSize}&sortField=${sortField}&sortDirection=${sortDirection}&search=${encodeURIComponent(searchTerm)}&filters=${filtersParam}`,
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

    // Fetch updated facet data
    await fetchFacetData()
  }

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    await fetchData(1) // Reset to first page on new search

    // Fetch updated facet data
    await fetchFacetData()
  }

  const handleFilter = async (field: string, values: string[]) => {
    const newFilters = { ...filters }

    if (values.length === 0) {
      // Remove filter if empty
      delete newFilters[field]
    } else {
      // Update filter values
      newFilters[field] = values
    }

    setFilters(newFilters)
    await fetchData(1) // Reset to first page on filter change

    // Fetch updated facet data with the new filters
    await fetchFacetData()
  }

  // Initialize activeFilters with empty arrays for enum columns
  useEffect(() => {
    const initialActiveFilters = { ...activeFilters }

    // For each column with type 'enum', initialize with empty array
    meetingColumns.forEach((column) => {
      if (column.type === 'enum' && column.options) {
        initialActiveFilters[column.key as string] = []
      }
    })

    setActiveFilters(initialActiveFilters)
  }, [])

  // Fetch facet data on component mount
  useEffect(() => {
    // Use setTimeout to make this non-blocking
    const timer = setTimeout(() => {
      fetchFacetData()
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return (
    <DataTableStatic
      data={data}
      columns={meetingColumns}
      idField="meetingId"
      defaultSortField={sortField as keyof MeetingTableDataType}
      defaultSortDirection={sortDirection}
      tableId="meetings-table"
      renderRowActions={renderMeetingActions}
      pastDateFilterOptions={pastDateFilterOptions}
      futureDateFilterOptions={futureDateFilterOptions}
      onlyFuture={onlyFuture}
      pagination={{
        pageSize,
        totalItems,
        totalPages,
        currentPage,
        onPageChange: handlePageChange,
      }}
      isLoading={isLoading || isFacetLoading}
      onServerSort={handleSort}
      onServerSearch={handleSearch}
      onServerFilter={handleFilter}
      serverSideProcessing={true}
      initialSearchTerm={searchTerm}
      searchPlaceholder="חיפוש בכל השדות..."
      activeFilters={activeFilters}
      setActiveFilters={setActiveFilters}
    />
  )
}
