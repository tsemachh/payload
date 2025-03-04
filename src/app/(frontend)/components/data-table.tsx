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
import type { FutureMeetingTableData } from '../types'
import { cn } from '@/lib/utils'
import { DateRangePicker } from '@/components/date-range-picker'
import { isWithinInterval } from 'date-fns'
import { BooleanIcon } from './ui/icons'
import { escapeRegExp, formatDateTime } from '../helpers/utils'
import { Checkbox } from './ui/checkbox'
import { MeetingState } from '@/payload-types'
import { meetingStateMap } from '../helpers/maps'

interface Column {
  key: keyof FutureMeetingTableData
  header: string
  type: 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'number'
  filterable?: boolean
  positionCenter?: boolean
  render?: (row: FutureMeetingTableData) => React.ReactNode
}

const columns: Column[] = [
  { key: 'stockNumber', header: 'מס׳ נייר', type: 'string' },
  { key: 'stockType', header: 'סוג נייר', type: 'string', filterable: true },
  { key: 'stockSymbol', header: 'סימול', type: 'string' },
  { key: 'stockName', header: 'שם נייר ערך', type: 'string' },
  { key: 'companyName', header: 'שם חברה', type: 'string' },
  {
    key: 'stockTradable',
    header: 'נייר ערך נסחר',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.stockTradable} />,
  },
  {
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL').format(Number((row.marketValue / 1_000_000).toFixed(3))),
  },
  {
    key: 'registeredValue',
    header: 'ערך נקוב (מיליוני ₪)',
    type: 'number',
    render: (row) =>
      new Intl.NumberFormat('he-IL').format(Number((row.registeredValue / 1_000_000).toFixed(3))),
  },
  { key: 'meetingType', header: 'סוג', type: 'string', filterable: true },
  {
    key: 'meetingDate',
    header: 'מועד',
    type: 'datetime',
    // filterable: true,
    render: (row) => {
      return formatDateTime(row.meetingDate)
    },
  },
  { key: 'reference', header: 'אסמכתא', type: 'string' },

  {
    key: 'meetingState',
    header: 'מצב',
    type: 'string',
    filterable: true,
    render: (row) =>
      meetingStateMap[row.meetingState as Exclude<MeetingState, null>] || row.meetingState,
  },
  {
    key: 'holdingsLimit',
    header: 'מועד קובע',
    type: 'datetime',
    // filterable: true,
    render: (row) => {
      return formatDateTime(row.holdingsLimit, true)
    },
  },
  {
    key: 'proxyVotingDate',
    header: 'מועד מסירת הצבעות',
    type: 'datetime',
    // filterable: true,
    render: (row) => {
      return formatDateTime(row.proxyVotingDate)
    },
  },
  { key: 'location', header: 'מיקום', type: 'string' },
  { key: 'comments', header: 'הערות', type: 'string' },
  {
    key: 'resultsConfirmationStatus',
    header: 'אימות תוצאות',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.resultsConfirmationStatus} />,
  },
  {
    key: 'electronicVotingEnabled',
    header: 'מופיעה במערכת האלק׳',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.electronicVotingEnabled} />,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    positionCenter: true,
    render: (row) => <BooleanIcon iconType={row.committeeInitiated} />,
  },
]

interface DataTableProps {
  data: FutureMeetingTableData[]
}

export function DataTable({ data }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FutureMeetingTableData
    direction: 'asc' | 'desc'
  }>({ key: 'meetingDate', direction: 'desc' })
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<{ [key: string]: any }>({})
  const [isFilterActive, setIsFilterActive] = useState(false)

  useEffect(() => {
    const loadColumnVisibility = () => {
      const storedColumns = localStorage.getItem('columnSelected')
      if (storedColumns) {
        try {
          const parsedColumns = JSON.parse(storedColumns)
          const validColumns = columns.map((col) => String(col.key))
          const filteredColumns = parsedColumns.filter((col: string) => validColumns.includes(col))

          if (filteredColumns.length !== parsedColumns.length) {
            localStorage.setItem('columnSelected', JSON.stringify(filteredColumns))
          }

          const newVisibility = Object.fromEntries(
            columns.map((col) => [String(col.key), filteredColumns.includes(String(col.key))]),
          )
          setColumnVisibility(newVisibility)
        } catch (error) {
          console.error('Error parsing stored columns:', error)
          setColumnVisibility(Object.fromEntries(columns.map((col) => [String(col.key), true])))
        }
      } else {
        setColumnVisibility(Object.fromEntries(columns.map((col) => [String(col.key), true])))
      }
    }

    loadColumnVisibility()
  }, [])

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key])
  }, [columnVisibility])

  const toggleColumnVisibility = useCallback((key: string) => {
    setColumnVisibility((prev) => {
      const newVisibility = { ...prev, [key]: !prev[key] }
      const selectedColumns = Object.entries(newVisibility)
        .filter(([, isVisible]) => isVisible)
        .map(([colKey]) => colKey)
      localStorage.setItem('columnSelected', JSON.stringify(selectedColumns))
      return newVisibility
    })
  }, [])

  const handleSort = useCallback((key: keyof FutureMeetingTableData) => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else if (current.direction === 'desc') {
          return { key, direction: 'asc' }
        }
      }
      return { key, direction: 'asc' }
    })
  }, [])

  const handleFilter = useCallback(
    (key: string, value: any) => {
      setFilters((prev) => {
        const newFilters = { ...prev }
        if (value === 'all') {
          // Initialize all options as checked when resetting the filter
          const allOptions = Array.from(
            new Set(data.map((item) => String(item[key as keyof FutureMeetingTableData]))),
          )
          newFilters[key] = allOptions
        } else if (Array.isArray(value)) {
          newFilters[key] = value
        }
        return newFilters
      })
    },
    [data],
  )

  const resetFilters = useCallback(() => {
    if (isFilterActive) {
      setFilters({})
      setIsFilterActive(false)
    } else {
      const initialFilters: { [key: string]: any } = {}
      columns.forEach((column) => {
        if (column.filterable) {
          const allOptions = Array.from(
            new Set(data.map((item) => String(item[column.key as keyof FutureMeetingTableData]))),
          )
          initialFilters[column.key] = allOptions
        }
      })
      setFilters(initialFilters)
      setIsFilterActive(true)
    }
  }, [data, isFilterActive])

  const highlightText = useCallback((text: string, highlight: string) => {
    if (!highlight.trim()) {
      return text
    }
    const regex = new RegExp(`(^|\\s)(${escapeRegExp(highlight)})`, 'gi')
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={{ backgroundColor: 'yellow' }}>
          {part}
        </span>
      ) : (
        part
      ),
    )
  }, [])

  const filteredAndSortedData = useMemo(() => {
    let filteredItems = [...data]
    // Apply search filter only on visible columns
    if (searchTerm) {
      const searchRegex = new RegExp(`(^|\\s)${escapeRegExp(searchTerm)}`, 'i')
      filteredItems = filteredItems.filter((item) =>
        visibleColumns.some((column) => {
          const value = item[column.key]
          return typeof value === 'string' && searchRegex.test(value)
        }),
      )
    }

    // Apply filters if there are active filters
    if (Object.keys(filters).length > 0) {
      filteredItems = filteredItems.filter((item) => {
        for (const [key, value] of Object.entries(filters)) {
          // If the filter is an empty array, no items should pass
          if (Array.isArray(value) && value.length === 0) {
            return false
          }

          // Handle date filters
          if (columns.find((col) => col.key === key)?.type === 'date') {
            // Skip if either date is missing
            if (!value.from || !value.to) {
              continue
            }

            const itemDate = new Date(item[key as keyof FutureMeetingTableData] as string)
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
            if (!value.includes(String(item[key as keyof FutureMeetingTableData]))) {
              return false
            }
          }
          // Handle other filter types
          else if (item[key as keyof FutureMeetingTableData] !== value) {
            return false
          }
        }
        return true
      })
    }

    // Apply sorting
    if (sortConfig.direction) {
      filteredItems.sort((a, b) => {
        if (sortConfig.key == null) return sortConfig.direction === 'asc' ? -1 : 1
        const bValue = b[sortConfig.key]
        const aValue = a[sortConfig.key]
        if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1
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
  }, [data, filters, searchTerm, sortConfig, visibleColumns])

  const getSortIcon = (columnKey: keyof FutureMeetingTableData) => {
    if (sortConfig.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="h-4 w-4 ml-2" />
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="h-4 w-4 " />
      }
    }
    return null
  }

  const getFilterIcon = (columnKey: string) => {
    if (!isFilterActive) return null
    if (facetedFilters[columnKey]?.length != filters[columnKey].length) {
      return <Filter className="h-4 w-4 ml-2" />
    }
    return <ChevronDown className="h-4 w-4 ml-2" />
  }

  const facetedFilters = useMemo(() => {
    const facets: {
      [key: string]: { value: string; count: number; icon?: React.ReactNode; translate?: string }[]
    } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        if (column.type === 'boolean') {
          const trueCount = data.filter((item) => item[column.key] === true).length
          const falseCount = data.filter((item) => item[column.key] === false).length
          facets[column.key] = []
          if (trueCount > 0) {
            facets[column.key].push({
              value: 'true',
              count: trueCount,
              icon: <BooleanIcon iconType={true} />,
            })
          }
          if (falseCount > 0) {
            facets[column.key].push({
              value: 'false',
              count: falseCount,
              icon: <BooleanIcon iconType={false} />,
            })
          }
        }
        if (column.key === 'meetingState') {
          const meetingStateCounts = data.reduce(
            (acc, { meetingState }) => {
              if (!meetingState) return acc // Skip null values
              acc[meetingState] = (acc[meetingState] || 0) + 1
              return acc
            },
            {} as Record<Exclude<MeetingState, null>, number>,
          )

          facets[column.key] = Object.entries(meetingStateCounts).map(([state, count]) => ({
            value: state,
            count,
            translate: meetingStateMap[state as Exclude<MeetingState, null>] || state,
          }))
        } else {
          const values = new Set(data.map((item) => String(item[column.key])))
          facets[column.key] = Array.from(values).map((value) => ({
            value,
            count: data.filter((item) => String(item[column.key]) === value).length,
          }))
        }
      }
    })
    return facets
  }, [data])

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
            placeholder="חיפוש כללי..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 text-right"
          ></Input>
        </div>
        <div className="flex space-x-2 space-x-reverse">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetFilters()}
            className={cn('flex justify-between items-center w-40', isFilterActive && 'bg-muted')}
          >
            {isFilterActive ? 'הסר סינון' : 'סינון'}
            {isFilterActive ? (
              <FilterX className="h-4 w-4 mr-2" />
            ) : (
              <Filter className="h-4 w-4 mr-2" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex justify-between items-center w-40"
              >
                <span>עמודות</span>
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
            <Table className="w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-gray-100">
                <TableRow className="bg-muted/50 border-b border-border">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        'text-right max-w-[200px] overflow-hidden text-ellipsis cursor-pointer',
                        sortConfig.key === column.key && 'bg-[#9fa8d9]',
                      )}
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="flex items-center justify-start">
                        <span>{column.header}</span>
                        {getSortIcon(column.key)}
                        {isFilterActive && column.filterable && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {getFilterIcon(column.key)}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {column.type === 'date' ? (
                                <DateRangePicker
                                  dateRange={filters[column.key] || { from: null, to: null }}
                                  onDateRangeChange={(range) => handleFilter(column.key, range)}
                                />
                              ) : (
                                facetedFilters[column.key]?.map(
                                  ({ value, count, icon, translate }) => (
                                    <DropdownMenuCheckboxItem
                                      key={value}
                                      checked={
                                        !filters[column.key] || filters[column.key].includes(value)
                                      }
                                      onCheckedChange={(checked) => {
                                        const currentFilters = filters[column.key] || []
                                        const newFilters = checked
                                          ? [...currentFilters, value]
                                          : currentFilters.filter((v: any) => v !== value)
                                        handleFilter(column.key, newFilters)
                                      }}
                                      className="flex items-center justify-between py-2 remove-checked"
                                    >
                                      <Checkbox
                                        checked={
                                          !filters[column.key] ||
                                          filters[column.key].includes(value)
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
                                onClick={() => handleFilter(column.key, 'all')}
                              >
                                בחר הכל
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="sticky left-0 z-10 w-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((row) => (
                  <TableRow
                    key={row.meetingId}
                    className="hover:bg-muted/70 group transition-colors"
                  >
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={`${row.meetingId}-${String(column.key)}`}
                        style={{
                          direction: column.type === 'datetime' ? 'ltr' : 'rtl',
                          placeItems: column.positionCenter ? 'center' : 'unset',
                          textAlign: column.positionCenter ? 'center' : 'right',
                        }}
                        className={`truncate py-2 px-3 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis`}
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
                          : highlightText(String(row[column.key]), searchTerm)}
                      </TableCell>
                    ))}
                    <TableCell className="relative group sticky left-[80px] z-10">
                      {row.meetingInviteUrl && (
                        <a href={row.meetingInviteUrl} target="_blank" rel="noopener noreferrer">
                          <span className="absolute hidden underlined-text decoration-2 h-full group-hover:flex items-center justify-center inset-0 group-hover:inline group-hover:bg-opacity-100 group-hover:bg-[#9fa8da]-100 group-hover:w-[100px] text-sm text-foreground text-blue-600 hover:text-blue-500 whitespace-nowrap">
                            קישור למגנה
                          </span>
                        </a>
                      )}
                    </TableCell>
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
