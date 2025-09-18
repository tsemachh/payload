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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Settings2,
  ArrowUp,
  ArrowDown,
  X,
  ChevronDown,
  ChevronLeft,
  Filter,
  FilterX,
  CalendarIcon,
} from 'lucide-react'
import React from 'react'
import { cn } from '@/lib/utils'
import {
  calculateColumnWidths,
  calculatePrecedingColumnsWidth,
  escapeRegExp,
  getStaticFilterOptions,
  updateFilter,
} from '../helpers/utils-data-table'
import { v4 as uuidv4 } from 'uuid'
import type {
  Column,
  CompanyTableDate,
  DataTableProps,
  MeetingTableDataType,
  FundType,
  FacetedFilterItemServer,
  DateFilterType,
  CustomDate,
} from '../types/meetings'
import LoadingSpinnerDiamond from './ui/loading-spinner-diamond'
import { unSortAbleColumnsOnServer } from '../meetings/meetingTableConstants'
import {
  renderCompaniesCell,
  renderFundsCell,
  renderAgendaCell,
} from '../meetings/renderExpandableCell'
import { useCompaniesContext } from '../context/companiesContext'
import CustomRadio from './custom-radio'
import { format } from 'date-fns'
import { Checkbox } from './ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Calendar } from './ui/calendar'
import { BooleanIcon } from './ui/icons'

export function DataTableServer<T extends Record<string, any>>({
  data = [],
  columns: initialColumns,
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
  defaultVisibleColumns = initialColumns.map((column) => column.key),
  pagination,
  isLoading = false,
  onServerSort,
  onServerSearch,
  onServerFilter,
  onServerDateFilter,
  serverSideProcessing = false,
  initialSearchTerm = '',
  tableHeightOffset = 250,
  renderExpandedRowContent,
  expanderColumnKey,
  columnsOption = true,
  searchOption = true,
  filterOption = true,
  selectAll = 'בחר הכל',
  removeAll = 'הסר הכל',
  selectedCompanyIds,
  createColumnsWithExpand,
  displayMode,
}: DataTableProps<T>) {
  const { companies } = useCompaniesContext()
  const [currentPage, setCurrentPage] = useState(pagination?.currentPage || 1)
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 50)
  const [companiesExpandedRows, setCompaniesExpandedRows] = useState<Record<string, boolean>>({})
  const [agendasExpandedRows, setAgendasExpandedRows] = useState<Record<string, boolean>>({})
  const [fundsExpandedRows, setFundsExpandedRows] = useState<Record<string, boolean>>({})
  const [columnVisibility, setColumnVisibility] = useState<{
    [key: string]: boolean
  }>({})

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
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [inputSearchTerm, setInputSearchTerm] = useState(initialSearchTerm)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<{ [key: string]: any }>(() => {
    const initialFilters: { [key: string]: any } = {}
    columns.forEach((column) => {
      if (column.filterable && column.type != 'datetime') {
        initialFilters[String(column.key)] = getStaticFilterOptions(column.key, column.type).map(
          (e) => e.value,
        )
      }
    })
    return initialFilters
  })
  const [isFilterActive, setIsFilterActive] = useState(false)
  const [dateFilters, setDateFilters] = useState<{
    [key: string]: DateFilterType
  }>(() => {
    const initialFilters: { [key: string]: DateFilterType } = {}
    columns.forEach((column) => {
      if (column.filterable && column.type == 'datetime') {
        initialFilters[String(column.key)] = {
          past: 'allPast',
          future: 'allFuture',
          empty: true,
          custom: false,
          customDate: {},
        }
      }
    })
    return initialFilters
  })
  const emptyDateOption = { value: 'empty', label: 'ללא תאריך' }

  useEffect(() => {
    setSearchTerm(initialSearchTerm)
    setInputSearchTerm(initialSearchTerm)
  }, [initialSearchTerm])

  useEffect(() => {
    if (searchTerm === '') {
      setInputSearchTerm('')
    }
  }, [searchTerm])

  useEffect(() => {
    const storageKey = `columnVisibility-${tableId}`
    const loadColumnVisibility = () => {
      const storedColumns = localStorage.getItem(storageKey)
      const alwaysVisible = columns
        .filter((col) => col.isAlwaysVisible)
        .map((col) => String(col.key))

      if (storedColumns) {
        try {
          const parsedColumns = JSON.parse(storedColumns)
          const validColumns = columns.map((col) => String(col.key))
          const filteredColumns = parsedColumns.filter(
            (col: string) => validColumns.includes(col) && col !== 'agenda',
          )
          const mergedColumns = Array.from(new Set([...filteredColumns, ...alwaysVisible]))
          if (mergedColumns.length !== parsedColumns.length) {
            localStorage.setItem(storageKey, JSON.stringify(mergedColumns))
          }
          const newVisibility = Object.fromEntries(
            columns.map((col) => [String(col.key), mergedColumns.includes(String(col.key))]),
          )
          setColumnVisibility(newVisibility)
        } catch (error) {
          console.error('Error parsing stored columns:', error)
          setDefaultVisibility()
        }
      } else {
        setDefaultVisibility()
      }
    }

    const setDefaultVisibility = () => {
      const alwaysVisible = columns
        .filter((col) => col.isAlwaysVisible)
        .map((col) => String(col.key))
      const mergedVisible = Array.from(
        new Set([...defaultVisibleColumns.map(String), ...alwaysVisible]),
      )
      const newVisibility = Object.fromEntries(
        columns.map((col) => [String(col.key), mergedVisible.includes(String(col.key))]),
      )
      setColumnVisibility(newVisibility)
      localStorage.setItem(storageKey, JSON.stringify(mergedVisible))
    }

    loadColumnVisibility()
  }, [columns, data, tableId])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    pagination?.onPageChange?.(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    pagination?.onPageSizeChange?.(newPageSize)
  }

  const [sortConfig, setSortConfig] = useState<{
    key: keyof T
    direction: 'asc' | 'desc'
  }>({
    key: (defaultSortField || columns[0].key) as keyof T,
    direction: defaultSortDirection,
  })

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key as string])
  }, [columns, columnVisibility])

  const columnWidths = useMemo(() => {
    const widths: { [key: string]: string } = {}
    visibleColumns.forEach((column) => {
      widths[String(column.key)] = `${
        calculateColumnWidths(column.minWidth, visibleColumns.length, column.width) + 40
      }px`
    })
    return widths
  }, [visibleColumns])

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

  const filteredAndSortedData = useMemo(() => {
    return [...data]
  }, [data])

  const handleSort = useCallback(
    (key: keyof T) => {
      if (unSortAbleColumnsOnServer.includes(key as string)) return
      if (onServerSort) {
        setSortConfig((current) => {
          const newDirection =
            current.key === key ? (current.direction === 'asc' ? 'desc' : 'asc') : 'asc'
          return { key, direction: newDirection }
        })
        onServerSort(key as string)
      }
    },
    [onServerSort],
  )

  const handleFilter = useCallback(
    (key: string, value: any, type?: string) => {
      if (serverSideProcessing && onServerFilter) {
        if (value === 'all') {
          onServerFilter(key, [])
        } else if (Array.isArray(value)) {
          if (value.length === facetedFiltersStatic[key].length) {
            onServerFilter(key, [])
          } else {
            if (value.length == 0) {
              onServerFilter(key, ['noOptionSelect'])
            } else {
              onServerFilter(key, value)
            }
          }
        }
        setFilters((prev) => {
          const newFilters = { ...prev }
          if (value === 'all') {
            newFilters[key] = getStaticFilterOptions(key, type).map((e) => e.value)
          } else if (Array.isArray(value)) {
            newFilters[key] = value
          }
          return newFilters
        })
      }
    },
    [data, serverSideProcessing, onServerFilter],
  )

  const handleDateFilter = useCallback(
    (columnKey: string, option: string, checked: boolean, customDate?: CustomDate) => {
      if (option === '') {
        const clearedFilter = {
          past: 'allPast',
          future: 'allFuture',
          empty: true,
          custom: false,
          customDate: {},
        }
        if (onServerDateFilter) {
          onServerDateFilter(columnKey, clearedFilter)
          setDateFilters((prev) => ({
            ...prev,
            [columnKey]: clearedFilter,
          }))
        }
        return
      }
      if (onServerDateFilter) {
        const currentFilter = dateFilters[columnKey] || {
          past: '',
          future: '',
          empty: false,
          custom: false,
          customDate: {},
        }
        const newFilter = updateFilter(option, checked, currentFilter, customDate)
        onServerDateFilter(columnKey, newFilter)
        setDateFilters((prev) => ({
          ...prev,
          [columnKey]: newFilter,
        }))
      }
    },
    [pastDateFilterOptions, futureDateFilterOptions, onServerDateFilter, dateFilters],
  )

  const updateCustomDate = (columnKey: string, customDate: CustomDate) => {
    if (onServerDateFilter) {
      const currentFilter = dateFilters[columnKey] || {
        past: '',
        future: '',
        empty: false,
        custom: false,
        customDate: {},
      }
      const newFilter = { ...currentFilter }
      newFilter.customDate = customDate
      setDateFilters((prev) => ({
        ...prev,
        [columnKey]: newFilter,
      }))
    }
  }
  const resetFilters = useCallback(() => {
    if (serverSideProcessing) {
      if (isFilterActive) {
        columns.forEach((column) => {
          if (column.filterable) {
            if (column.type === 'datetime') {
              if (onServerDateFilter) {
                onServerDateFilter(column.key as string, {
                  past: 'allPast',
                  future: 'allFuture',
                  empty: true,
                  custom: false,
                  customDate: {},
                })
              }
            } else {
              if (onServerFilter) {
                onServerFilter(column.key as string, [])
              }
            }
          }
        })
        setIsFilterActive(false)
      } else {
        setIsFilterActive(true)
      }
    }
  }, [data, columns, isFilterActive, serverSideProcessing, onServerFilter, onServerDateFilter])

  const highlightText = useCallback((text: string, highlight: string) => {
    if (!highlight.trim()) {
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

  const getSortIcon = (columnKey: keyof T) => {
    if (onServerSort === undefined) return null
    if (sortConfig.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="h-4 w-4" />
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="h-4 w-4" />
      }
    }
    return null
  }
  const toggleRowExpand = useCallback(
    (rowId: string) => {
      if (!renderExpandedRowContent) return
      setExpandedRowIds((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(rowId)) {
          newSet.delete(rowId)
        } else {
          newSet.add(rowId)
        }
        return newSet
      })
    },
    [renderExpandedRowContent],
  )

  const getFilterIcon = (columnKey: string, columnType: string) => {
    if (!isFilterActive) return null
    const column = columns.find((col) => col.key === columnKey)
    if (column?.type === 'datetime') {
      const dateFilter = dateFilters[columnKey]
      if (
        dateFilter?.past === 'allPast' &&
        dateFilter?.future === 'allFuture' &&
        dateFilter?.empty
      ) {
        return <ChevronDown />
      }
      return <Filter />
    }
    const allOptions = getStaticFilterOptions(columnKey, columnType).map((e) => e.value)
    if (filters[columnKey].length < allOptions.length) {
      return <Filter className="h-4 w-4 " />
    }
    return <ChevronDown className="h-4 w-4 " />
  }

  const facetedFiltersStatic = useMemo(() => {
    const facets: {
      [key: string]: FacetedFilterItemServer[]
    } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        const staticOptions = getStaticFilterOptions(column.key as string, column.type)
        facets[column.key as string] = [
          ...(staticOptions.length > 1 && column.type != 'boolean' ? [{ value: selectAll }] : []),
          ...staticOptions,
        ]
      }
    })
    return facets
  }, [columns])

  return (
    <div className="space-y-4 text-right pr-10 pl-10" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        {searchOption && (
          <div className="relative w-1/3">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {inputSearchTerm && (
              <X
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground cursor-pointer z-10"
                onClick={() => {
                  setSearchTerm('')
                  setInputSearchTerm('')
                  if (onServerSearch) {
                    onServerSearch('')
                  }
                }}
              />
            )}
            <Input
              placeholder={searchPlaceholder}
              value={inputSearchTerm}
              onChange={(e) => {
                setInputSearchTerm(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchTerm(inputSearchTerm)
                  if (onServerSearch) {
                    onServerSearch(inputSearchTerm.trim())
                  }
                }
              }}
              onBlur={() => {
                setSearchTerm(inputSearchTerm)
                if (onServerSearch) {
                  onServerSearch(inputSearchTerm.trim())
                }
              }}
              className="pr-10 text-right"
              disabled={isLoading}
            />
          </div>
        )}
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
                  className="flex justify-between items-center w-40"
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
            <Table className="table-fixed w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-secondary">
                <TableRow className="bg-muted border-b border-border hover:bg-muted/80">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn('text-right overflow-hidden text-ellipsis')}
                      style={{
                        width: columnWidths[String(column.key)],
                      }}
                    >
                      <div
                        className="flex items-center justify-start"
                        style={{
                          width: columnWidths[String(column.key)],
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
                                {getFilterIcon(String(column.key), column.type)}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              style={{
                                overflowY: 'auto',
                                maxHeight: `calc(100vh - ${tableHeightOffset + 20}px)`,
                              }}
                            >
                              {column.type === 'datetime' ? (
                                <div>
                                  <div className="p-2 border-t border-gray-200 w-[180px]">
                                    <DropdownMenuCheckboxItem
                                      checked={dateFilters[String(column.key)]?.custom || false}
                                      onSelect={(e) => e.preventDefault()}
                                      onCheckedChange={(checked) => {
                                        handleDateFilter(
                                          String(column.key),
                                          'custom',
                                          checked,
                                          dateFilters[String(column.key)]?.customDate,
                                        )
                                      }}
                                      className="flex items-center justify-between py-2 remove-checked"
                                    >
                                      <CustomRadio
                                        checked={dateFilters[String(column.key)]?.custom || false}
                                        size="md"
                                        disabled={
                                          !dateFilters[String(column.key)]?.customDate.startDate ||
                                          !dateFilters[String(column.key)]?.customDate.endDate
                                        }
                                      />
                                      <div className="flex justify-between gap-2" dir="rtl">
                                        <span className="text-right text-xs">מותאם אישית </span>
                                      </div>
                                    </DropdownMenuCheckboxItem>

                                    <div className="mt-3">
                                      <div className="flex flex-col space-y-3">
                                        <div className="flex flex-row-reverse items-center gap-2">
                                          <label className="text-right text-xs ml-auto">
                                            החל מ
                                          </label>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className={cn(
                                                  'text-left font-normal text-sm w-auto',
                                                  !dateFilters[String(column.key)]?.customDate
                                                    ?.startDate && 'text-muted-foreground',
                                                )}
                                              >
                                                <CalendarIcon className="mr-2 h-2 w-2" />
                                                {dateFilters[String(column.key)]?.customDate
                                                  ?.startDate ? (
                                                  format(
                                                    dateFilters[String(column.key)].customDate
                                                      .startDate!,
                                                    'dd/MM/yy',
                                                  )
                                                ) : (
                                                  <span className="text-xs">בחר</span>
                                                )}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                              <Calendar
                                                mode="single"
                                                selected={
                                                  dateFilters[String(column.key)]?.customDate
                                                    ?.startDate
                                                }
                                                onSelect={(date) => {
                                                  const currentEndDate =
                                                    dateFilters[String(column.key)]?.customDate
                                                      ?.endDate
                                                  if (date || currentEndDate) {
                                                    updateCustomDate(String(column.key), {
                                                      startDate: date || undefined,
                                                      endDate: currentEndDate,
                                                    })
                                                  }
                                                }}
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>

                                        <div className="flex flex-row-reverse items-center gap-2">
                                          <label className="text-right text-xs  ml-auto">עד</label>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                className={cn(
                                                  'justify-start text-right font-normal text-sm w-auto',
                                                  !dateFilters[String(column.key)]?.customDate
                                                    .endDate && 'text-muted-foreground',
                                                )}
                                              >
                                                <CalendarIcon className="mr-2 h-2 w-2" />
                                                {dateFilters[String(column.key)]?.customDate
                                                  .endDate ? (
                                                  format(
                                                    dateFilters[String(column.key)].customDate
                                                      .endDate!,
                                                    'dd/MM/yy',
                                                  )
                                                ) : (
                                                  <span className="text-xs">בחר</span>
                                                )}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                              <Calendar
                                                mode="single"
                                                selected={
                                                  dateFilters[String(column.key)]?.customDate
                                                    .endDate
                                                }
                                                onSelect={(date) => {
                                                  const currentStartDate =
                                                    dateFilters[String(column.key)]?.customDate
                                                      .startDate
                                                  if (currentStartDate || date) {
                                                    updateCustomDate(String(column.key), {
                                                      startDate: currentStartDate,
                                                      endDate: date || undefined,
                                                    })
                                                  }
                                                }}
                                                disabled={(date) =>
                                                  dateFilters[String(column.key)]?.customDate
                                                    .startDate
                                                    ? date <
                                                      dateFilters[String(column.key)].customDate
                                                        .startDate!
                                                    : false
                                                }
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  </div>
                                </div>
                              ) : (
                                facetedFiltersStatic[column.key as string]?.map(
                                  ({ value, icon, translate }: FacetedFilterItemServer) => {
                                    const isSelectAllOption = value === selectAll
                                    const allPossibleValues = facetedFiltersStatic[
                                      column.key as string
                                    ]
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
                  {renderRowActions && <TableHead className="sticky left-0 z-10 w-0"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((row) => (
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
                          className={`truncate py-2 px-3 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis`}
                          ref={(el) => {
                            if (
                              !el ||
                              column.key == 'companies' ||
                              typeof row[column.key] == 'object'
                            )
                              return
                            el.setAttribute(
                              'title',
                              el.scrollWidth > el.clientWidth ? String(row[column.key]) : '',
                            )
                          }}
                        >
                          {expanderColumnKey === column.key && renderExpandedRowContent && (
                            <span
                              className="inline-flex items-center justify-center ml-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRowExpand(row[idField] as string)
                              }}
                            >
                              {expandedRowIds.has(row[idField] as string) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronLeft className="h-4 w-4" />
                              )}
                            </span>
                          )}
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
                                : highlightText(
                                    String(row[column.key] === '-' ? '' : (row[column.key] ?? '')),
                                    searchTerm,
                                  )}
                        </TableCell>
                      ))}
                      {renderRowActions && (
                        <TableCell className="relative group sticky left-[0px] z-10 p-0 w-0 hover:z-20">
                          {renderRowActions(row)}
                        </TableCell>
                      )}
                    </TableRow>
                    {renderExpandedRowContent &&
                      expandedRowIds.has(row[idField] as string) &&
                      renderExpandedRowContent(row)}
                    {companiesExpandedRows[row.meetingId] &&
                      row.companies &&
                      row.companies.length > 0 && (
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
                                  <TableCell className="py-2 px-3"></TableCell>

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
                                              <span className="absolute right-0 top-1/2 -translate-y-1/2 font-medium truncate">
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
                                          <TableCell className="py-2 px-6"></TableCell>

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
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 font-medium truncate"
                                                        style={{
                                                          maxWidth: calculatePrecedingColumnsWidth(
                                                            visibleColumns as unknown as Column<MeetingTableDataType>[],
                                                            company,
                                                          ),
                                                        }}
                                                      >
                                                        {fund.holdingsCompanyName}
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
                    {agendasExpandedRows[row.meetingId] && (
                      <>
                        {row.agendas?.map((agenda: any, index: number) => (
                          <TableRow
                            key={`agenda-${row.meetingId}-${index}`}
                            className="bg-muted/40 border-t-0 hover:bg-primary/20"
                          >
                            <TableCell className="py-2 px-3"></TableCell>
                            {visibleColumns.slice(1).map((column, columnIndex) => (
                              <TableCell
                                key={`agenda-${row.meetingId}-${index}-${String(column.key)}`}
                                className="py-2 px-3 whitespace-nowrap"
                                style={{ textAlign: 'right' }}
                              >
                                {columnIndex === 0 && (
                                  <div className="relative">
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                      <span className="shrink-0">{index + 1}.</span>
                                      <span className="truncate">{agenda.text}</span>
                                    </div>
                                  </div>
                                )}
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
      </div>

      {pagination && !isLoading && (
        <div className="flex items-center justify-between space-x-2 mt-0 mb-0">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="text-sm text-muted-foreground">
              סה&quot;כ {pagination.totalItems?.toLocaleString()} שורות.
            </div>
            {pagination.pageSizeOptions &&
              pagination.onPageSizeChange &&
              pagination.totalPages > 1 && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="text-sm text-muted-foreground">שורות בעמוד:</span>
                  <select
                    className="h-8 w-[80px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    disabled={isLoading}
                  >
                    {pagination.pageSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
          {pagination.totalPages && (
            <div className="flex items-center space-x-2 space-x-reverse">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1 || isLoading}
                className="min-w-[80px]"
              >
                {'הקודם'}
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center">{`עמוד ${currentPage} מתוך ${pagination.totalPages}`}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(currentPage + 1, pagination.totalPages))}
                disabled={currentPage === pagination.totalPages || isLoading}
                className="min-w-[80px]"
              >
                {'הבא'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
