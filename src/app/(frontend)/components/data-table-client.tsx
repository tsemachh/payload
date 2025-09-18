'use client'

import React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Filter,
  FilterX,
  Search,
  Settings2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isWithinInterval } from 'date-fns'
import { BooleanIcon } from './ui/icons'
import {
  calculateColumnWidths,
  calculatePrecedingColumnsWidth,
  escapeRegExp,
  formatDateTime,
  isDateInRange,
  isDateOption,
  isValidDate,
} from '../helpers/utils-data-table'
import { Checkbox } from './ui/checkbox'
import type { MeetingState, StockOrigin } from '@/payload-types'
import { meetingStateMap, stockOriginMap } from '../helpers/maps'
import type {
  Column,
  DataTableProps,
  FacetedFilterItem,
  CompanyTableDate,
  FundType,
  MeetingTableDataType,
} from '../types/meetings'
import { getDateRange } from '../helpers/utils-data-table'
import { v4 as uuidv4 } from 'uuid'
import LoadingSpinnerDiamond from './ui/loading-spinner-diamond'
import {
  renderAgendaCell,
  renderCompaniesCell,
  renderFundsCell,
} from '../meetings/renderExpandableCell'
import { useCompaniesContext } from '../context/companiesContext'
import CustomRadio from './custom-radio'

export function DataTableStatic<T extends Record<string, any>>({
  data,
  columns: initialColumns,
  pastDateFilterOptions = [],
  futureDateFilterOptions = [],
  idField,
  defaultSortField,
  defaultSortDirection = 'asc',
  tableId = 'default-table',
  renderRowActions,
  searchPlaceholder = 'חיפוש כללי...',
  filterOption = true,
  filterLabel = 'סינון',
  columnsOption = true,
  columnsLabel = 'עמודות',
  defaultVisibleColumns = initialColumns.map((column) => column.key),
  onlyFuture = false,
  tableHeightOffset = 200,
  isLoading = false,
  selectAll = 'בחר הכל',
  removeAll = 'הסר הכל',
  pagination,
  displayMode,
  selectedCompanyIds,
  createColumnsWithExpand,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T
    direction: 'asc' | 'desc'
  }>({
    key: (defaultSortField || initialColumns[0].key) as keyof T,
    direction: defaultSortDirection,
  })
  const { companies } = useCompaniesContext()
  const [columnVisibility, setColumnVisibility] = useState<{
    [key: string]: boolean
  }>({})
  const [companiesExpandedRows, setCompaniesExpandedRows] = useState<Record<string, boolean>>({})
  const [agendasExpandedRows, setAgendasExpandedRows] = useState<Record<string, boolean>>({})
  const [fundsExpandedRows, setFundsExpandedRows] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [inputSearchTerm, setInputSearchTerm] = useState('')
  const [filters, setFilters] = useState<{ [key: string]: any }>({})
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [dateFilters, setDateFilters] = useState<{
    [key: string]: { past: string; future: string; empty: boolean }
  }>({})
  const [currentPage, setCurrentPage] = useState<number>(pagination?.currentPage || 1)
  const emptyDateOption = { value: 'empty', label: 'ללא תאריך' }

  // Create columns with expand functionality if provided
  const columns = useMemo(() => {
    if (createColumnsWithExpand) {
      // Pass agendas state only if displayMode is 'agenda'
      const agendasState = displayMode === 'agenda' ? agendasExpandedRows : undefined
      const setAgendasState = displayMode === 'agenda' ? setAgendasExpandedRows : undefined

      return createColumnsWithExpand(
        companiesExpandedRows,
        setCompaniesExpandedRows,
        setFundsExpandedRows,
        agendasState,
        setAgendasState,
        data as any,
      )
    }
    return initialColumns
  }, [
    createColumnsWithExpand,
    companiesExpandedRows,
    agendasExpandedRows,
    data,
    initialColumns,
    displayMode,
  ])

  useEffect(() => {
    setInputSearchTerm(searchTerm)
  }, [searchTerm])

  // Update current page when pagination prop changes
  useEffect(() => {
    if (pagination?.currentPage) {
      setCurrentPage(pagination.currentPage)
    }
  }, [pagination?.currentPage])

  useEffect(() => {
    if (columnsOption) {
      // Load column visibility from localStorage
      const loadColumnVisibility = () => {
        const storedColumns = localStorage.getItem(`columnVisibility-${tableId}`)
        const alwaysVisible = columns
          .filter((col) => col.isAlwaysVisible)
          .map((col) => String(col.key))

        if (storedColumns) {
          try {
            const parsedColumns: string[] = JSON.parse(storedColumns)
            const validColumns = columns.map((col) => String(col.key))

            // Filter out any invalid column keys
            const filteredColumns = parsedColumns.filter((col) => validColumns.includes(col))

            // Add alwaysVisible columns if they're not already in localStorage
            const mergedColumns = Array.from(new Set([...filteredColumns, ...alwaysVisible]))

            if (mergedColumns.length !== parsedColumns.length) {
              localStorage.setItem(`columnVisibility-${tableId}`, JSON.stringify(mergedColumns))
            }

            const newVisibility = Object.fromEntries(
              columns.map((col) => [String(col.key), mergedColumns.includes(String(col.key))]),
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
        // Always-visible column keys
        const alwaysVisible = columns
          .filter((col) => col.isAlwaysVisible)
          .map((col) => String(col.key))

        // Merge defaultVisibleColumns with alwaysVisible, removing duplicates
        const mergedVisible = Array.from(
          new Set([...defaultVisibleColumns.map(String), ...alwaysVisible]),
        )

        // Set visibility for each column
        const newVisibility = Object.fromEntries(
          columns.map((col) => [String(col.key), mergedVisible.includes(String(col.key))]),
        )

        setColumnVisibility(newVisibility)
        localStorage.setItem(`columnVisibility-${tableId}`, JSON.stringify(mergedVisible))
      }

      loadColumnVisibility()
    }
    // Filters:
    const initialFilters: { [key: string]: any } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        initialFilters[String(column.key)] = Array.from(
          new Set(data.map((item) => String(item[column.key as keyof T]))),
        )
      }
    })
    setFilters(initialFilters)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, data, tableId])

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    let filteredColumns = columnsOption
      ? columns.filter((column) => columnVisibility[column.key as string])
      : columns

    // Filter columns based on displayMode
    if (displayMode === 'companies') {
      // Show companies column, hide agenda column
      filteredColumns = filteredColumns.filter((column) => column.key !== 'agenda')
    } else if (displayMode === 'agenda') {
      filteredColumns = filteredColumns.filter((column) => column.key !== 'companies')
    }

    return filteredColumns
  }, [columnsOption, columns, columnVisibility, displayMode])
  // Component for individual agenda item with tooltip
  const AgendaItem = ({ agenda, index }: { agenda: any; index: number }) => {
    const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.())
    const direction = isEnglish ? 'ltr' : 'rtl'
    const alignment = isEnglish ? 'text-left' : 'text-right'

    const [tooltipPosition, setTooltipPosition] = React.useState<{
      x: number
      y: number
      visible: boolean
    }>({ x: 0, y: 0, visible: false })

    const handleMouseMove = (e: React.MouseEvent) => {
      const tooltipWidth = 400
      const tooltipHeight = 100

      let x = e.clientX + 10 // 10px to the right of cursor
      let y = e.clientY - tooltipHeight - 10 // 10px above cursor

      // Check if tooltip goes off screen horizontally
      if (x + tooltipWidth > window.innerWidth) {
        x = e.clientX - tooltipWidth - 10 // Show to the left instead
      }

      // Check if tooltip goes off screen vertically
      if (y < 0) {
        y = e.clientY + 10 // Show below cursor instead
      }

      setTooltipPosition({ x, y, visible: true })
    }

    const handleMouseLeave = () => {
      setTooltipPosition((prev) => ({ ...prev, visible: false }))
    }

    return (
      <div className="relative">
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 cursor-help"
          style={{ maxWidth: 'calc(100vw - 150px)' }}
          onMouseMove={agenda.text && agenda.text.length > 30 ? handleMouseMove : undefined}
          onMouseLeave={handleMouseLeave}
        >
          {/* Index always on the right */}
          <span className="shrink-0 order-1">{index + 1}.</span>
          {/* Text content with proper direction */}
          <div
            dir={direction}
            className={cn('relative order-2', alignment)}
            style={{ maxWidth: 'calc(100vw - 200px)' }} // Adjust based on your layout
          >
            <span
              className={cn(
                'block',
                isEnglish ? 'truncate' : 'text-ellipsis overflow-hidden whitespace-nowrap',
              )}
              style={
                !isEnglish
                  ? {
                      direction: 'rtl',
                      textOverflow: 'ellipsis',
                      unicodeBidi: 'plaintext',
                      maxWidth: 'calc(100vw - 200px)',
                    }
                  : {
                      maxWidth: 'calc(100vw - 200px)',
                    }
              }
            >
              {agenda.text}
            </span>
          </div>
        </div>

        {/* Dynamic positioned tooltip */}
        {agenda.text && agenda.text.length > 30 && tooltipPosition.visible && (
          <div
            className="fixed z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg whitespace-normal break-words pointer-events-none transition-opacity duration-200"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              maxWidth: '400px',
              wordWrap: 'break-word',
              direction: direction,
              textAlign: isEnglish ? 'left' : 'right',
            }}
          >
            {agenda.text}
          </div>
        )}
      </div>
    )
  }
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
      // Handling the meeting state field
      if (columnKey === 'stockOrigin' && item.stockOrigin) {
        return (
          stockOriginMap[item.stockOrigin as Exclude<StockOrigin, null>] || String(item.stockOrigin)
        )
      }

      if (item[columnKey] == '-') {
        return '' //empty value
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
        if (value === selectAll) {
          // Initialize all options as checked when resetting the filter
          newFilters[key] = Array.from(new Set(data.map((item) => String(item[key as keyof T]))))
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
          newFilters[columnKey] = {
            past: 'allPast',
            future: 'allFuture',
            empty: true,
          }
          return newFilters
        })
        return
      }

      setDateFilters((prev) => {
        const currentFilter = prev[columnKey] || {
          past: '',
          future: '',
          empty: false,
        }
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
          initialFilters[String(column.key)] = Array.from(
            new Set(data.map((item) => String(item[column.key as keyof T]))),
          )
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
          if (trueCount) {
            facets[column.key as string].push({
              value: 'true',
              count: trueCount,
              icon: <BooleanIcon iconType={true} />,
            })
          }
          if (falseCount) {
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
          const hasMultipleOptions = Object.keys(meetingStateCounts).length > 1
          facets[column.key as string] = [
            ...(hasMultipleOptions ? [{ value: selectAll, count: filteredData.length }] : []),
            ...Object.entries(meetingStateCounts).map(([state, count]) => ({
              value: state,
              count,
              translate: meetingStateMap[state as Exclude<MeetingState, null>] || state,
            })),
          ]
        } else if (column.key === 'stockOrigin') {
          const stockOriginCounts = filteredData.reduce(
            (acc, { stockOrigin }) => {
              if (!stockOrigin) return acc // Skip null values
              acc[stockOrigin as keyof typeof acc] = (acc[stockOrigin as keyof typeof acc] || 0) + 1
              return acc
            },
            {} as Record<Exclude<MeetingState, null>, number>,
          )
          const hasMultipleOptions = Object.keys(stockOriginCounts).length > 1
          facets[column.key as string] = [
            ...(hasMultipleOptions ? [{ value: selectAll, count: filteredData.length }] : []),
            ...Object.entries(stockOriginCounts).map(([state, count]) => ({
              value: state,
              count,
              translate: stockOriginMap[state as Exclude<StockOrigin, null>] || state,
            })),
          ]
        } else {
          const values = new Set(filteredData.map((item) => String(item[column.key])))
          facets[column.key as string] = [
            ...(values.size > 1 ? [{ value: selectAll, count: filteredData.length }] : []),
            ...Array.from(values).map((value) => ({
              value,
              count: filteredData.filter((item) => String(item[column.key]) === value).length,
            })),
          ]
        }
      }
    })
    return facets
  }, [columns, getFilteredDataExcludingColumn])

  // Get paginated data if pagination is enabled
  const paginatedData = useMemo(() => {
    if (!pagination) {
      return filteredAndSortedData // Return all data if pagination is not enabled
    }

    const { pageSize } = pagination
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize

    return filteredAndSortedData.slice(startIndex, endIndex)
  }, [filteredAndSortedData, pagination, currentPage])

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    if (pagination?.onPageChange) {
      pagination.onPageChange(page)
    }
  }

  // Render the data table
  return (
    <div className="space-y-4 text-right pr-10 pl-10" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <div className="relative w-1/3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {inputSearchTerm && (
            <X
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ז-10"
              onClick={() => {
                setSearchTerm('')
                setInputSearchTerm('')
              }}
            />
          )}
          <Input
            placeholder={searchPlaceholder}
            value={inputSearchTerm}
            onChange={(e) => setInputSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchTerm(e.currentTarget.value)
              }
            }}
            onBlur={(e) => setSearchTerm(e.currentTarget.value)}
            className="pr-10 text-right"
            disabled={isLoading}
          />
        </div>
        <div className="flex space-x-2 space-x-reverse">
          {filterOption && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetFilters()}
              className={cn('flex justify-between items-center w-40', isFilterActive && 'bg-muted')}
              disabled={isLoading}
            >
              {isFilterActive ? `הסר ${filterLabel}` : filterLabel}
              {isFilterActive ? (
                <FilterX className="h-4 w-4 mr-2" />
              ) : (
                <Filter className="h-4 w-4 mr-2" />
              )}
            </Button>
          )}
          {columnsOption && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex justify-between items-center w-40 bg-transparent"
                  disabled={isLoading}
                >
                  <span>{columnsLabel}</span>
                  <Settings2 className="h-4 w-4 mr-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                style={{
                  overflowY: 'auto',
                  maxHeight: `calc(100vh - ${tableHeightOffset + 20}px)`,
                }}
              >
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={String(column.key)}
                    disabled={column.isAlwaysVisible}
                    checked={columnVisibility[String(column.key)]}
                    onCheckedChange={() => toggleColumnVisibility(String(column.key))}
                    onSelect={(event) => event.preventDefault()}
                    dir="rtl"
                  >
                    {column.header ? column.header : 'עמודה'}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="bg-background relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <LoadingSpinnerDiamond />
            </div>
          </div>
        )}
        <div className="rounded-md border cursor-default">
          <div
            className="overflow-auto relative"
            style={{
              maxHeight: `calc(100vh - ${tableHeightOffset}px)`,
            }}
          >
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
                          width: `${calculateColumnWidths(column.minWidth, visibleColumns.length, column.width)}px`,
                        }}
                      >
                        <span
                          className={`${isLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                          onClick={() => !isLoading && handleSort(column.key)}
                        >
                          {column.renderHeader
                            ? column.renderHeader()
                            : column.noHeader
                              ? ''
                              : column.header}
                        </span>
                        <span
                          className={`${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => !isLoading && handleSort(column.key)}
                        >
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
                                        {/* Past dates */}
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
                                                <CustomRadio checked={isChecked} size="md" />
                                                <div
                                                  className="flex justify-between gap-2"
                                                  dir="rtl"
                                                >
                                                  <span className="text-right text-xs">
                                                    {option.label}
                                                  </span>
                                                  <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left text-xs">
                                                    {counts[option.value]}
                                                  </span>
                                                </div>
                                              </DropdownMenuCheckboxItem>
                                            )
                                          })}
                                        </div>
                                        <div className="border-r border-gray-200 mx-2" />
                                      </>
                                    )}
                                    {/* Future dates */}
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
                                            <CustomRadio checked={isChecked} size="md" />
                                            <div className="flex justify-between gap-2" dir="rtl">
                                              <span className="text-right text-xs">
                                                {option.label}
                                              </span>
                                              <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left text-xs">
                                                {counts[option.value]}
                                              </span>
                                            </div>
                                          </DropdownMenuCheckboxItem>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* Empty date option */}
                                  {(() => {
                                    const emptyDateCount = getDateFilterCounts(String(column.key))[
                                      emptyDateOption.value
                                    ]
                                    if (!emptyDateCount) return null
                                    return (
                                      <div className="p-2 border-t border-gray-200 mt-2">
                                        <DropdownMenuCheckboxItem
                                          checked={dateFilters[String(column.key)]?.empty}
                                          onSelect={(e) => e.preventDefault()}
                                          onCheckedChange={(checked) => {
                                            handleDateFilter(String(column.key), 'empty', checked)
                                          }}
                                          className="flex items-center justify-between py-2 remove-checked"
                                        >
                                          <CustomRadio
                                            checked={dateFilters[String(column.key)]?.empty}
                                            size="md"
                                          />
                                          <div className="flex justify-between gap-2" dir="rtl">
                                            <span className="text-right text-xs">
                                              {emptyDateOption.label}
                                            </span>
                                            <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left text-xs">
                                              {emptyDateCount}
                                            </span>
                                          </div>
                                        </DropdownMenuCheckboxItem>
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : (
                                facetedFilters[column.key as string]?.map(
                                  ({ value, count, icon, translate }: FacetedFilterItem) => {
                                    const isSelectAllOption = value === selectAll
                                    const allPossibleValues = facetedFilters[column.key as string]
                                      .map((item) => item.value)
                                      .filter((v) => v !== selectAll)
                                    const currentSelectedFilters =
                                      filters[column.key as string] || []

                                    const isChecked = isSelectAllOption
                                      ? currentSelectedFilters.length ===
                                          allPossibleValues.length && allPossibleValues.length > 0
                                      : currentSelectedFilters.includes(value)
                                    const handleToggle = (checked: boolean) => {
                                      if (isSelectAllOption) {
                                        const newFilters = checked ? allPossibleValues : []
                                        handleFilter(String(column.key), newFilters)
                                      } else {
                                        const newFilters = checked
                                          ? [...currentSelectedFilters, value]
                                          : currentSelectedFilters.filter(
                                              (v: string) => v !== value,
                                            )
                                        handleFilter(String(column.key), newFilters)
                                      }
                                    }

                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={value}
                                        checked={isChecked}
                                        onCheckedChange={handleToggle}
                                        className="flex items-center justify-between py-2 remove-checked"
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        <Checkbox
                                          checked={isChecked}
                                          className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ml-[-25px] mr-[15px]"
                                        />
                                        <div className="flex justify-between gap-2" dir="rtl">
                                          <span
                                            className="text-right text-xs"
                                            style={isSelectAllOption ? { fontWeight: 'bold' } : {}}
                                          >
                                            {icon
                                              ? icon
                                              : translate
                                                ? translate
                                                : isSelectAllOption && isChecked
                                                  ? removeAll
                                                  : value}
                                          </span>
                                          <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground min-w-[2rem] text-left text-xs">
                                            {count}
                                          </span>
                                        </div>
                                      </DropdownMenuCheckboxItem>
                                    )
                                  },
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  ))}

                  {renderRowActions && <TableHead className="sticky left-0 z-[-1] w-0"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row) => (
                  <React.Fragment key={row.meetingId + uuidv4()}>
                    <TableRow key={uuidv4()} className="group hover:bg-primary/20">
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={`${String(row[idField])}-${String(column.key)}`}
                          style={{
                            direction: column.type === 'datetime' ? 'ltr' : 'rtl',
                            placeItems: column.positionCenter ? 'center' : 'unset',
                            textAlign: column.positionCenter ? 'center' : 'right',
                          }}
                          className="truncate py-2 px-3 whitespace-nowrap max-w-[20px] overflow-hidden text-ellipsis"
                          ref={(el) => {
                            if (
                              !el ||
                              column.key == 'companies' ||
                              typeof row[column.key] == 'object'
                            )
                              return
                            const isEllipsisActive = el.offsetWidth < el.scrollWidth
                            el.setAttribute(
                              'title',
                              isEllipsisActive ? String(row[column.key]) : '',
                            )
                          }}
                        >
                          {column.key === 'companies'
                            ? renderCompaniesCell(
                                {
                                  ...row,
                                  companies: row.companies?.filter((c: any) =>
                                    selectedCompanyIds?.includes(c.id),
                                  ),
                                },
                                companiesExpandedRows,
                                setCompaniesExpandedRows,
                                setFundsExpandedRows,
                              )
                            : column.key === 'agenda'
                              ? renderAgendaCell(row, agendasExpandedRows, setAgendasExpandedRows)
                              : column.render
                              ? column.render(row as MeetingTableDataType & T)
                              : highlightText(getDisplayValue(row, column.key), searchTerm)}
                        </TableCell>
                      ))}
                      {renderRowActions && (
                        <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                          {renderRowActions(row)}
                        </TableCell>
                      )}
                    </TableRow>
                    {companiesExpandedRows[row.meetingId] &&
                      row.companies &&
                      row.companies.length > 0 &&
                      displayMode === 'companies' && (
                        <>
                          {row.companies
                            .filter((company: CompanyTableDate) =>
                              selectedCompanyIds?.includes(company.id),
                            )
                            .map((company: CompanyTableDate) => (
                              <React.Fragment key={row.meetingId + uuidv4()}>
                                <TableRow
                                  key={`company-${uuidv4()}`}
                                  className="bg-muted/40 border-t-0 hover:bg-primary/20"
                                >
                                  {/* Empty cell for companies column */}
                                  <TableCell className="py-2 px-3"></TableCell>

                                  {/* Map through visible columns and show relevant company data */}
                                  {visibleColumns.slice(1).map((column, columnIndex) => {
                                    if (column.key === 'reported') {
                                      const companyVote = row.votes?.docs?.find(
                                        (v: any) => v.company === company.id,
                                      )
                                      return (
                                        <TableCell
                                          key={`company-${company.id}-reported`}
                                          className="py-2 px-3 whitespace-nowrap text-center"
                                        >
                                          <BooleanIcon
                                            iconType={companyVote?.reported}
                                            showX={false}
                                          />
                                        </TableCell>
                                      )
                                    }
                                    if (column.key in company) {
                                      return (
                                        <TableCell
                                          key={`company-${uuidv4()}-${String(column.key)}`}
                                          className="py-2 px-3 whitespace-nowrap"
                                          style={{ textAlign: 'right' }}
                                        >
                                          {(() => {
                                            const value =
                                              company[column.key as keyof CompanyTableDate]
                                            if (typeof value === 'number') {
                                              return new Intl.NumberFormat('he-IL').format(value)
                                            }
                                          })()}
                                        </TableCell>
                                      )
                                    } else {
                                      return (
                                        <TableCell
                                          key={`company-${uuidv4()}-${String(column.key)}`}
                                          className="py-2 px-3 whitespace-nowrap"
                                        >
                                          {columnIndex === 0 && (
                                            <div className="relative h-40px">
                                              <span className="absolute right-0 top-1/2 -translate-y-1/2  truncate">
                                                {renderFundsCell(
                                                  company,
                                                  companies.find((c) => c.id === company.id)
                                                    ?.name || '',
                                                  fundsExpandedRows,
                                                  setFundsExpandedRows,
                                                  visibleColumns,
                                                )}
                                              </span>
                                            </div>
                                          )}
                                        </TableCell>
                                      )
                                    }
                                  })}

                                  {renderRowActions && (
                                    <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                                      {renderRowActions(row)}
                                    </TableCell>
                                  )}
                                </TableRow>
                                {fundsExpandedRows[company.id] &&
                                  company.funds &&
                                  company.funds.length > 0 && (
                                    <>
                                      {company.funds.map((fund: FundType) => (
                                        <TableRow
                                          key={`fund-${uuidv4()}`}
                                          className="bg-muted/70 border-t-0 hover:bg-primary/20"
                                        >
                                          {/* Empty cell for companies column */}
                                          <TableCell className="py-2 px-6"></TableCell>

                                          {/* Map through visible columns and show relevant fund data */}
                                          {visibleColumns.slice(1).map((column, columnIndex) => {
                                            if (column.key in fund) {
                                              return (
                                                <TableCell
                                                  key={`fund-${uuidv4()}-${String(column.key)}`}
                                                  className="py-2 px-3 whitespace-nowrap"
                                                  style={{ textAlign: 'right' }}
                                                >
                                                  {(() => {
                                                    const value = fund[column.key as keyof FundType]
                                                    if (typeof value === 'number') {
                                                      return new Intl.NumberFormat('he-IL').format(
                                                        value,
                                                      )
                                                    }
                                                  })()}
                                                </TableCell>
                                              )
                                            } else {
                                              return (
                                                <TableCell
                                                  key={`fund-${uuidv4()}-${String(column.key)}`}
                                                  className="py-2 px-3 pr-14 whitespace-nowrap"
                                                >
                                                  {columnIndex === 0 && (
                                                    <div className="relative h-40px mr-7">
                                                      <span
                                                        className="absolute right-0 top-1/2 -translate-y-1/2  truncate"
                                                        style={{
                                                          maxWidth: calculatePrecedingColumnsWidth(
                                                            visibleColumns as unknown as Column<MeetingTableDataType>[],
                                                            company,
                                                            true,
                                                          ),
                                                        }}
                                                      >
                                                        {`${fund.holdingsCompanyName} `}
                                                        {fund.passiveFund && <b>אין חובת הצבעה </b>}
                                                      </span>
                                                    </div>
                                                  )}
                                                </TableCell>
                                              )
                                            }
                                          })}

                                          {renderRowActions && (
                                            <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                                              {renderRowActions(row)}
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </>
                                  )}
                              </React.Fragment>
                            ))}
                        </>
                      )}
                    {displayMode === 'agenda' && agendasExpandedRows[row.meetingId] && (
                      <>
                        {row.agendas.map((agenda: any, index: number) => (
                          <TableRow
                            key={`agenda-${row.meetingId}-${index}`}
                            className="bg-muted/40 border-t-0 hover:bg-primary/20"
                          >
                            {/* Empty cell for companies column */}
                            <TableCell className="py-2 px-3"></TableCell>
                            {/* Map through visible columns and show agenda text in first column */}
                            {visibleColumns.slice(1).map((column, columnIndex) => (
                              <TableCell
                                key={`agenda-${row.meetingId}-${index}-${String(column.key)}`}
                                className="py-2 px-3 whitespace-nowrap"
                                style={{ textAlign: 'right' }}
                              >
                                {columnIndex === 0 && <AgendaItem agenda={agenda} index={index} />}
                              </TableCell>
                            ))}
                            {renderRowActions && (
                              <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                                {renderRowActions(row)}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination Controls */}
        {pagination && (
          <div className="flex justify-center items-center mt-4 space-x-2 space-x-reverse">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || isLoading}
            >
              ראשון
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              הקודם
            </Button>

            <span className="mx-2">
              עמוד {currentPage} מתוך{' '}
              {pagination.totalPages ||
                Math.ceil(filteredAndSortedData.length / pagination.pageSize) ||
                1}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={
                currentPage ===
                  (pagination.totalPages ||
                    Math.ceil(filteredAndSortedData.length / pagination.pageSize)) || isLoading
              }
            >
              הבא
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePageChange(
                  pagination.totalPages ||
                    Math.ceil(filteredAndSortedData.length / pagination.pageSize),
                )
              }
              disabled={
                currentPage ===
                  (pagination.totalPages ||
                    Math.ceil(filteredAndSortedData.length / pagination.pageSize)) || isLoading
              }
            >
              אחרון
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
