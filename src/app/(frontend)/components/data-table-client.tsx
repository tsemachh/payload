'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Settings2,
  ArrowUp,
  ArrowDown,
  Filter,
  ChevronDown,
  FilterX,
  X,
} from 'lucide-react'
import type React from 'react'
import { cn } from '@/lib/utils'
import { isWithinInterval } from 'date-fns'
import { BooleanIcon } from './ui/icons'
import {
  calculateColumnWidths,
  escapeRegExp,
  formatDateTime,
  isDateInRange,
  isDateOption,
  isValidDate,
} from '../helpers/utils'
import { Checkbox } from './ui/checkbox'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'
import { DataTableProps, FacetedFilterItem, MeetingTableDataType } from '../types/meetings'
import { defaultVisibleColumns, getDateRange } from '../meetings-future/meetingTableConstants'
import { v4 as uuidv4 } from 'uuid'

export function DataTableStatic<T extends Record<string, any>>({
  data,
  columns,
  pastDateFilterOptions = [],
  futureDateFilterOptions = [],
  idField,
  defaultSortField,
  defaultSortDirection = 'desc',
  tableId = 'default-table',
  renderRowActions,
  searchPlaceholder = 'חיפוש כללי...',
  filterLabel = 'סינון',
  columnsLabel = 'עמודות',
  onlyFuture = false,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T
    direction: 'asc' | 'desc'
  }>({
    key: (defaultSortField || columns[0].key) as keyof T,
    direction: defaultSortDirection,
  })
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<{ [key: string]: any }>({})
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [dateFilters, setDateFilters] = useState<{
    [key: string]: { past: string; future: string; empty: boolean }
  }>({})
  const emptyDateOption = { value: 'empty', label: 'ללא תאריך' }

  useEffect(() => {
    // Load column visibility from localStorage
    const loadColumnVisibility = () => {
      const storedColumns = localStorage.getItem(`columnVisibility-${tableId}`)
      if (storedColumns) {
        try {
          const parsedColumns = JSON.parse(storedColumns)
          const validColumns = columns.map((col) => String(col.key))
          const filteredColumns = parsedColumns.filter((col: string) => validColumns.includes(col))

          if (filteredColumns.length !== parsedColumns.length) {
            localStorage.setItem(`columnVisibility-${tableId}`, JSON.stringify(filteredColumns))
          }

          const newVisibility = Object.fromEntries(
            columns.map((col) => [String(col.key), filteredColumns.includes(String(col.key))]),
          )
          setColumnVisibility(newVisibility)
        } catch (error) {
          console.error('Error parsing stored columns:', error)
          setDefaultColumnVisibility()
        }
      } else {
        setDefaultColumnVisibility()
      }
    }

    const setDefaultColumnVisibility = () => {
      const newVisibility = Object.fromEntries(
        columns.map((col) => [String(col.key), defaultVisibleColumns.includes(String(col.key))]),
      )
      setColumnVisibility(newVisibility)
      localStorage.setItem(`columnVisibility-${tableId}`, JSON.stringify(defaultVisibleColumns))
    }

    loadColumnVisibility()
    // Filters:
    const initialFilters: { [key: string]: any } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        const allOptions = Array.from(
          new Set(data.map((item) => String(item[column.key as keyof T]))),
        )
        initialFilters[String(column.key)] = allOptions
      }
    })
    setFilters(initialFilters)
    const initialDateFilters: { [key: string]: { past: string; future: string; empty: boolean } } =
      {}
    columns.forEach((column) => {
      if (column.type === 'datetime' && column.filterable) {
        initialDateFilters[column.key as string] = {
          past: 'allPast',
          future: 'allFuture',
          empty: true,
        }
      }
    })
    setDateFilters(initialDateFilters)
  }, [columns, data, tableId])

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key as string])
  }, [columns, columnVisibility])

  // Toggle column visibility
  const toggleColumnVisibility = useCallback(
    (key: string) => {
      setColumnVisibility((prev) => {
        const newVisibility = { ...prev, [key]: !prev[key] }
        const selectedColumns = Object.entries(newVisibility)
          .filter(([, isVisible]) => isVisible)
          .map(([colKey]) => colKey)
        localStorage.setItem(`columnVisibility-${tableId}`, JSON.stringify(selectedColumns))
        return newVisibility
      })
    },
    [tableId],
  )

  // Function that extracts the displayed value of a field
  const getDisplayValue = useCallback(
    (item: T, columnKey: keyof T): string => {
      const column = columns.find((col) => col.key === columnKey)
      if (!column) return String(item[columnKey] || '')

      // Handling date fields
      if (column.type === 'datetime') {
        return formatDateTime(item[columnKey] as string, columnKey === 'holdingsLimit')
      }

      // Handling the meeting state field
      if (columnKey === 'meetingState' && item.meetingState) {
        return (
          meetingStateMap[item.meetingState as Exclude<MeetingState, null>] ||
          String(item.meetingState)
        )
      }
      return String(item[columnKey] || '')
    },
    [columns],
  )
  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filteredItems = [...data]

    // Apply date filters
    Object.entries(dateFilters).forEach(([columnKey, { past, future, empty }]) => {
      // If all filters are in their default state, skip filtering
      if (past === 'allPast' && future === 'allFuture' && empty) return
      filteredItems = filteredItems.filter((item) => {
        const dateValue = item[columnKey as keyof MeetingTableDataType] as string
        if (!isValidDate(dateValue)) {
          return empty
        }
        const itemDate = new Date(dateValue)
        const matchesPast = past ? isDateInRange(itemDate, getDateRange(past)) : false
        const matchesFuture = future ? isDateInRange(itemDate, getDateRange(future)) : false
        return matchesPast || matchesFuture
      })
    })

    // Apply filters if there are active filters
    if (Object.keys(filters).length > 0) {
      filteredItems = filteredItems.filter((item) => {
        for (const [key, value] of Object.entries(filters)) {
          // If the filter is an empty array, no items should pass
          if (Array.isArray(value) && value.length === 0) {
            return false
          }
          // Handle date filters
          if (columns.find((col) => col.key === key)?.type === 'datetime') {
            // Skip if either date is missing
            if (!value.from || !value.to) {
              continue
            }
            const itemDate = new Date(item[key as keyof T] as string)
            if (
              !isWithinInterval(itemDate, {
                start: value.from,
                end: value.to,
              })
            ) {
              return false
            }
          }
          // Handle array filters (faceted)
          else if (Array.isArray(value)) {
            if (!value.includes(String(item[key as keyof T]))) {
              return false
            }
          }
          // Handle other filter types
          else if (item[key as keyof T] !== value) {
            return false
          }
        }
        return true
      })
    }

    // Apply search filter only on visible columns
    if (searchTerm) {
      const trimmedSearchTerm = searchTerm.trim()
      const searchRegex = new RegExp(`(^|\\s)${escapeRegExp(trimmedSearchTerm)}`, 'i')
      filteredItems = filteredItems.filter((item) =>
        visibleColumns.some((column) => {
          const displayValue = getDisplayValue(item, column.key)
          return displayValue && searchRegex.test(displayValue)
        }),
      )
    }

    // Apply sorting
    if (sortConfig.direction) {
      filteredItems.sort((a, b) => {
        const column = columns.find((col) => col.key === sortConfig.key)
        const sortKey = column?.sortKey || sortConfig.key

        if (sortConfig.key == null) return sortConfig.direction === 'asc' ? -1 : 1

        const bValue = b[sortKey]
        const aValue = a[sortKey]

        if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return filteredItems
  }, [
    data,
    dateFilters,
    filters,
    searchTerm,
    sortConfig.direction,
    sortConfig.key,
    columns,
    visibleColumns,
    getDisplayValue,
  ])

  const getFilteredDataExcludingColumn = useCallback(
    (columnKey: string) => {
      let filteredItems = [...data]
      // Apply date filters except for the current column
      Object.entries(dateFilters).forEach(([key, { past, future, empty }]) => {
        if (key === columnKey) return // Skip current column
        // If both past and future are set to 'all', treat it as no filter
        if (past === 'allPast' && future === 'allFuture' && empty) return
        filteredItems = filteredItems.filter((item) => {
          const dateValue = item[key as keyof MeetingTableDataType] as string

          // Check if the date is empty/invalid and if we should include it
          if (!isValidDate(dateValue)) {
            return empty
          }

          const itemDate = new Date(dateValue) // Check if the item matches the past filter
          const matchesPast = past ? isDateInRange(itemDate, getDateRange(past)) : false
          // Check if the item matches the future filter
          const matchesFuture = future ? isDateInRange(itemDate, getDateRange(future)) : false
          // Item passes if it matches either the past or future filter
          return matchesPast || matchesFuture
        })
      })

      // Apply search filter
      if (searchTerm) {
        const trimmedSearchTerm = searchTerm.trim()
        const searchRegex = new RegExp(`(^|\\s)${escapeRegExp(trimmedSearchTerm)}`, 'i')
        filteredItems = filteredItems.filter((item) =>
          visibleColumns.some((column) => {
            const displayValue = getDisplayValue(item, column.key)
            return displayValue && searchRegex.test(displayValue)
          }),
        )
      }

      // Apply other filters except for the current column
      Object.entries(filters).forEach(([key, value]) => {
        if (key === columnKey) return // Skip current column
        // If the filter is an empty array, no items should pass
        if (Array.isArray(value) && value.length === 0) {
          filteredItems = []
          return
        }
        // Handle date filters
        if (columns.find((col) => col.key === key)?.type === 'datetime') {
          // Skip if either date is missing
          if (!value.from || !value.to) {
            return
          }
          filteredItems = filteredItems.filter((item) => {
            const itemDate = new Date(item[key as keyof MeetingTableDataType] as string)
            return isWithinInterval(itemDate, {
              start: value.from,
              end: value.to,
            })
          })
        }
        // Handle array filters (faceted)
        else if (Array.isArray(value)) {
          filteredItems = filteredItems.filter((item) =>
            value.includes(String(item[key as keyof MeetingTableDataType])),
          )
        }
        // Handle other filter types
        else {
          filteredItems = filteredItems.filter(
            (item) => item[key as keyof MeetingTableDataType] === value,
          )
        }
      })
      return filteredItems
    },
    [columns, data, dateFilters, filters, searchTerm, visibleColumns, getDisplayValue],
  )

  const getDateFilterCounts = useCallback(
    (columnKey: string) => {
      const filteredData = getFilteredDataExcludingColumn(columnKey)
      const counts: Record<string, number> = {}

      // Count items for past date options
      pastDateFilterOptions.forEach((option) => {
        const dateRange = getDateRange(option.value)
        counts[option.value] = filteredData.filter((item) => {
          const dateValue = item[columnKey as keyof MeetingTableDataType] as string
          if (!isValidDate(dateValue)) return false
          const itemDate = new Date(dateValue)
          return isDateInRange(itemDate, dateRange)
        }).length
      })

      // Count items for future date options
      futureDateFilterOptions.forEach((option) => {
        const dateRange = getDateRange(option.value)
        counts[option.value] = filteredData.filter((item) => {
          const dateValue = item[columnKey as keyof MeetingTableDataType] as string
          if (!isValidDate(dateValue)) return false
          const itemDate = new Date(dateValue)
          return isDateInRange(itemDate, dateRange)
        }).length
      })

      // Count items with empty/invalid dates
      counts[emptyDateOption.value] = filteredData.filter((item) => {
        const dateValue = item[columnKey as keyof MeetingTableDataType] as string
        return !isValidDate(dateValue)
      }).length

      return counts
    },
    [
      getFilteredDataExcludingColumn,
      pastDateFilterOptions,
      futureDateFilterOptions,
      emptyDateOption.value,
    ],
  )

  // Handle sort
  const handleSort = useCallback((key: keyof T) => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else {
          return { key, direction: 'asc' }
        }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  // Handle filter
  const handleFilter = useCallback(
    (key: string, value: any) => {
      setFilters((prev) => {
        const newFilters = { ...prev }
        if (value === 'all') {
          // Initialize all options as checked when resetting the filter
          const allOptions = Array.from(new Set(data.map((item) => String(item[key as keyof T]))))
          newFilters[key] = allOptions
        } else if (Array.isArray(value)) {
          newFilters[key] = value
        }
        return newFilters
      })
    },
    [data],
  )

  // Handle date filter
  const handleDateFilter = useCallback(
    (columnKey: string, option: string, checked: boolean) => {
      if (option === '') {
        // Clear all filters for this column
        setDateFilters((prev) => {
          const newFilters = { ...prev }
          newFilters[columnKey] = { past: 'allPast', future: 'allFuture', empty: true }
          return newFilters
        })
        return
      }

      setDateFilters((prev) => {
        const currentFilter = prev[columnKey] || { past: '', future: '', empty: true }
        const newFilter = { ...currentFilter }

        if (option === 'empty') {
          // Toggle the empty filter
          newFilter.empty = checked
        } else if (isDateOption(option, pastDateFilterOptions)) {
          // If unchecking, clear the past filter
          if (!checked) {
            newFilter.past = ''
          } else {
            // Replace the past filter with the new option
            newFilter.past = option
          }
        } else if (isDateOption(option, futureDateFilterOptions)) {
          // If unchecking, clear the future filter
          if (!checked) {
            newFilter.future = ''
          } else {
            // Replace the future filter with the new option
            newFilter.future = option
          }
        }

        return { ...prev, [columnKey]: newFilter }
      })
    },
    [pastDateFilterOptions, futureDateFilterOptions],
  )
  // Reset filters
  const resetFilters = useCallback(() => {
    if (isFilterActive) {
      setFilters({})
      setIsFilterActive(false)
      const initialDateFilters: {
        [key: string]: { past: string; future: string; empty: boolean }
      } = {}
      columns.forEach((column) => {
        if (column.type === 'datetime' && column.filterable) {
          initialDateFilters[column.key as string] = {
            past: 'allPast',
            future: 'allFuture',
            empty: true,
          }
        }
      })
      setDateFilters(initialDateFilters)
    } else {
      const initialFilters: { [key: string]: any } = {}
      columns.forEach((column) => {
        if (column.filterable) {
          const allOptions = Array.from(
            new Set(data.map((item) => String(item[column.key as keyof T]))),
          )
          initialFilters[String(column.key)] = allOptions
        }
      })
      setFilters(initialFilters)
      setIsFilterActive(true)
      const initialDateFilters: {
        [key: string]: { past: string; future: string; empty: boolean }
      } = {}
      columns.forEach((column) => {
        if (column.type === 'datetime' && column.filterable) {
          initialDateFilters[column.key as string] = {
            past: 'allPast',
            future: 'allFuture',
            empty: true,
          }
        }
      })
      setDateFilters(initialDateFilters)
    }
  }, [data, columns, isFilterActive])

  // Highlight search term in text
  const highlightText = useCallback((text: string, highlight: string) => {
    if (!highlight.trim() || !text) {
      return text
    }
    const regex = new RegExp(`(^|\\s)(${escapeRegExp(highlight.trim())})`, 'gi')
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-primary/20">
          {part}
        </span>
      ) : (
        part
      ),
    )
  }, [])

  // Get sort icon for column header
  const getSortIcon = (columnKey: keyof T) => {
    if (sortConfig.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="h-4 w-4" />
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="h-4 w-4" />
      }
    }
    return null
  }

  // Get filter icon for column header
  const getFilterIcon = (columnKey: string) => {
    if (!isFilterActive) return null
    const column = columns.find((col) => col.key === columnKey)
    if (column?.key == 'meetingDate' && onlyFuture) {
      const dateFilter = dateFilters[columnKey]
      if (dateFilter?.future === 'allFuture' && dateFilter?.empty) {
        return <ChevronDown />
      }
    }
    if (column?.type === 'datetime') {
      const dateFilter = dateFilters[columnKey]
      if (
        dateFilter?.past === 'allPast' &&
        dateFilter?.future === 'allFuture' &&
        dateFilter?.empty
      ) {
        return <ChevronDown />
      } else {
        return <Filter />
      }
    }
    if (!filters[columnKey]) {
      return <ChevronDown className="h-4 w-4 " />
    }
    const allPossibleValues = Array.from(
      new Set(data.map((item) => String(item[columnKey as keyof MeetingTableDataType]))),
    )
    const allSelected = allPossibleValues.every((value) => filters[columnKey].includes(value))
    return allSelected ? <ChevronDown className="h-4 w-4 " /> : <Filter className="h-4 w-4 " />
  }

  // Generate faceted filters
  const facetedFilters = useMemo(() => {
    const facets: {
      [key: string]: FacetedFilterItem[]
    } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        const filteredData = getFilteredDataExcludingColumn(column.key as string)
        if (column.type === 'boolean') {
          const trueCount = filteredData.filter(
            (item) => item[column.key as keyof typeof item] === true,
          ).length
          const falseCount = filteredData.filter(
            (item) => item[column.key as keyof typeof item] === false,
          ).length
          facets[column.key as string] = []
          if (trueCount > 0) {
            facets[column.key as string].push({
              value: 'true',
              count: trueCount,
              icon: <BooleanIcon iconType={true} />,
            })
          }
          if (falseCount > 0) {
            facets[column.key as string].push({
              value: 'false',
              count: falseCount,
              icon: <BooleanIcon iconType={false} />,
            })
          }
        } else if (column.key === 'meetingState') {
          const meetingStateCounts = filteredData.reduce(
            (acc, { meetingState }) => {
              if (!meetingState) return acc // Skip null values
              acc[meetingState as keyof typeof acc] =
                (acc[meetingState as keyof typeof acc] || 0) + 1
              return acc
            },
            {} as Record<Exclude<MeetingState, null>, number>,
          )

          facets[column.key as string] = Object.entries(meetingStateCounts).map(
            ([state, count]) => ({
              value: state,
              count,
              translate: meetingStateMap[state as Exclude<MeetingState, null>] || state,
            }),
          )
        } else {
          const values = new Set(filteredData.map((item) => String(item[column.key])))
          facets[column.key as string] = Array.from(values).map((value) => ({
            value,
            count: filteredData.filter((item) => String(item[column.key]) === value).length,
          }))
        }
      }
    })
    return facets
  }, [columns, getFilteredDataExcludingColumn])

  // Render the data table
  return (
    <div className="space-y-4 text-right pr-10 pl-10" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <div className="relative w-1/3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {searchTerm && (
            <X
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ז-10"
              onClick={() => setSearchTerm('')}
            />
          )}
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 text-right"
          />
        </div>
        <div className="flex space-x-2 space-x-reverse">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetFilters()}
            className={cn('flex justify-between items-center w-40', isFilterActive && 'bg-muted')}
          >
            {isFilterActive ? `הסר ${filterLabel}` : filterLabel}
            {isFilterActive ? (
              <FilterX className="h-4 w-4 mr-2" />
            ) : (
              <Filter className="h-4 w-4 mr-2" />
            )}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex justify-between items-center w-40"
              >
                <span>{columnsLabel}</span>
                <Settings2 className="h-4 w-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={String(column.key)}
                  checked={columnVisibility[String(column.key)]}
                  onCheckedChange={() => toggleColumnVisibility(String(column.key))}
                  onSelect={(event) => event.preventDefault()}
                  dir="rtl"
                >
                  {typeof column.header === 'string' ? column.header : 'עמודה'}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-background">
        <div className="rounded-md border cursor-default">
          <div className="max-h-[calc(100vh-200px)] overflow-auto relative">
            <Table className="table-auto w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-secondary">
                <TableRow className="bg-muted border-b border-border hover:bg-muted/80">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn('text-right overflow-hidden text-ellipsis')}
                    >
                      <div
                        className="flex items-center justify-start"
                        style={{
                          width: `${calculateColumnWidths(column.minWidth, visibleColumns.length)}px`,
                        }}
                      >
                        <span className="cursor-pointer" onClick={() => handleSort(column.key)}>
                          {column.header}
                        </span>
                        <span className="cursor-pointer" onClick={() => handleSort(column.key)}>
                          {getSortIcon(column.key)}
                        </span>

                        {isFilterActive && column.filterable && (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {getFilterIcon(String(column.key))}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {column.type === 'datetime' ? (
                                <div className="flex flex-col">
                                  <div className="flex">
                                    {!(column.key == 'meetingDate' && onlyFuture) && (
                                      <>
                                        {/* Past dates column */}
                                        <div className="p-2">
                                          {pastDateFilterOptions.map((option) => {
                                            const counts = getDateFilterCounts(String(column.key))
                                            const isChecked =
                                              dateFilters[String(column.key)]?.past === option.value
                                            return (
                                              <DropdownMenuCheckboxItem
                                                key={option.value}
                                                checked={isChecked}
                                                onCheckedChange={(checked) => {
                                                  handleDateFilter(
                                                    String(column.key),
                                                    option.value,
                                                    checked,
                                                  )
                                                }}
                                                className="flex items-center justify-between py-2 remove-checked"
                                                onSelect={(e) => e.preventDefault()}
                                              >
                                                <Checkbox
                                                  checked={isChecked}
                                                  className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ml-[-25px] mr-[15px]"
                                                />
                                                <div
                                                  className="flex justify-between gap-2"
                                                  dir="rtl"
                                                >
                                                  <span className="text-right">{option.label}</span>
                                                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left">
                                                    {counts[option.value]}
                                                  </span>
                                                </div>
                                              </DropdownMenuCheckboxItem>
                                            )
                                          })}
                                        </div>
                                        <div className="border-r border-gray-200 mx-2"></div>
                                      </>
                                    )}
                                    {/* Future dates column */}
                                    <div className="p-2">
                                      {futureDateFilterOptions.map((option) => {
                                        const counts = getDateFilterCounts(String(column.key))
                                        const isChecked =
                                          dateFilters[String(column.key)]?.future === option.value
                                        return (
                                          <DropdownMenuCheckboxItem
                                            key={option.value}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                              handleDateFilter(
                                                String(column.key),
                                                option.value,
                                                checked,
                                              )
                                            }}
                                            className="flex items-center justify-between py-2 remove-checked"
                                            onSelect={(e) => e.preventDefault()}
                                          >
                                            <Checkbox
                                              checked={isChecked}
                                              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ml-[-25px] mr-[15px]"
                                            />
                                            <div className="flex justify-between gap-2" dir="rtl">
                                              <span className="text-right">{option.label}</span>
                                              <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left">
                                                {counts[option.value]}
                                              </span>
                                            </div>
                                          </DropdownMenuCheckboxItem>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* Empty date option */}
                                  <div className="p-2 border-t border-gray-200 mt-2">
                                    <DropdownMenuCheckboxItem
                                      checked={dateFilters[String(column.key)]?.empty}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(checked) => {
                                        handleDateFilter(String(column.key), 'empty', checked)
                                      }}
                                      className="flex items-center justify-between py-2 remove-checked"
                                    >
                                      <Checkbox
                                        checked={dateFilters[String(column.key)]?.empty}
                                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ml-[-25px] mr-[15px]"
                                      />
                                      <div className="flex justify-between gap-2" dir="rtl">
                                        <span className="text-right">{emptyDateOption.label}</span>
                                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left">
                                          {
                                            getDateFilterCounts(String(column.key))[
                                              emptyDateOption.value
                                            ]
                                          }
                                        </span>
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  </div>
                                </div>
                              ) : (
                                facetedFilters[column.key as string]?.map(
                                  ({ value, count, icon, translate }: FacetedFilterItem) => (
                                    <DropdownMenuCheckboxItem
                                      key={value}
                                      checked={
                                        !filters[column.key as string] ||
                                        filters[column.key as string].includes(value)
                                      }
                                      onCheckedChange={(checked) => {
                                        const currentFilters = filters[column.key as string] || []
                                        const newFilters = checked
                                          ? [...currentFilters, value]
                                          : currentFilters.filter((v: any) => v !== value)
                                        handleFilter(String(column.key), newFilters)
                                      }}
                                      className="flex items-center justify-between py-2 remove-checked"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Checkbox
                                        checked={
                                          !filters[column.key as string] ||
                                          filters[column.key as string].includes(value)
                                        }
                                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ml-[-25px] mr-[15px]"
                                      />
                                      <div className="flex justify-between gap-2" dir="rtl">
                                        <span className="text-right">
                                          {icon ? icon : translate ? translate : value}
                                        </span>
                                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left">
                                          {count}
                                        </span>
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  ),
                                )
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="justify-center text-center"
                                onClick={() =>
                                  column.type === 'datetime'
                                    ? handleDateFilter(String(column.key), '', false)
                                    : handleFilter(String(column.key), 'all')
                                }
                              >
                                הסר סינון
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  {renderRowActions && <TableHead className="sticky left-0 z-10 w-0"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((row) => (
                  <TableRow key={uuidv4()} className="group hover:bg-primary/20">
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={`${String(row[idField])}-${String(column.key)}`}
                        style={{
                          direction: column.type === 'datetime' ? 'ltr' : 'rtl',
                          placeItems: column.positionCenter ? 'center' : 'unset',
                          textAlign: column.positionCenter ? 'center' : 'right',
                        }}
                        className={`truncate py-2 px-3 whitespace-nowrap max-w-[20px] overflow-hidden text-ellipsis`}
                        ref={(el) => {
                          if (!el) return
                          el.setAttribute(
                            'title',
                            el.scrollWidth > el.clientWidth ? String(row[column.key]) : '',
                          )
                        }}
                      >
                        {column.render
                          ? column.render(row)
                          : highlightText(getDisplayValue(row, column.key), searchTerm)}
                      </TableCell>
                    ))}
                    {renderRowActions && (
                      <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                        {renderRowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
