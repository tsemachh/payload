'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Search, Check, X, Settings2, ArrowUp, ArrowDown, Filter, ChevronDown } from 'lucide-react'
import type React from 'react'
import { StatusType, type FutureMeetingTableData } from '../types'
import { cn } from '@/lib/utils'
import { DateRangePicker } from '@/components/date-range-picker'
import { isWithinInterval } from 'date-fns'

interface Column {
  key: keyof FutureMeetingTableData
  header: string
  type: 'string' | 'number' | 'date' | 'boolean'
  filterable?: boolean
  render?: (row: FutureMeetingTableData) => React.ReactNode
}

const columns: Column[] = [
  { key: 'stockNumber', header: 'מס׳ נייר', type: 'string' },
  { key: 'stockType', header: 'סוג נייר', type: 'string', filterable: true },
  { key: 'companyName', header: 'שם חברה', type: 'string' },
  { key: 'meetingType', header: 'סוג אסיפה', type: 'string', filterable: true },
  { key: 'meetingDate', header: 'תאריך האסיפה', type: 'date', filterable: true },
  { key: 'location', header: 'מיקום', type: 'string' },
  { key: 'holdingsLimit', header: 'מועד קובע', type: 'date', filterable: true },
  { key: 'proxyVotingDate', header: 'תאריך מסירת הצבעות', type: 'date', filterable: true },
  { key: 'comments', header: 'הערות', type: 'string' },
  {
    key: 'electronicVotingEnabled',
    header: 'האסיפה מופיעה במערכת האלק׳?',
    type: 'boolean',
    filterable: true,
    render: (row) =>
      row.electronicVotingEnabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  {
    key: 'resultsConfirmationStatus',
    header: 'אימות תוצאות האסיפה',
    type: 'boolean',
    filterable: true,
    render: (row) =>
      row.resultsConfirmationStatus ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    type: 'boolean',
    filterable: true,
    render: (row) =>
      row.committeeInitiated ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  {
    key: '_status',
    header: 'סטטוס',
    type: 'string',
    filterable: true,
    render: (row) => {
      switch (row._status) {
        case StatusType.Publish:
          return 'פורסם'
        case StatusType.Draft:
          return 'טיוטה'
        default:
          return row._status
      }
    },
  },
]

interface DataTableProps {
  data: FutureMeetingTableData[]
}

export function DataTable({ data }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FutureMeetingTableData
    direction: 'asc' | 'desc' | null
  }>({ key: 'meetingDate', direction: 'asc' })
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

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => {
      const newVisibility = { ...prev, [key]: !prev[key] }
      const selectedColumns = Object.entries(newVisibility)
        .filter(([, isVisible]) => isVisible)
        .map(([colKey]) => colKey)
      localStorage.setItem('columnSelected', JSON.stringify(selectedColumns))
      return newVisibility
    })
  }

  const handleSort = (key: keyof FutureMeetingTableData) => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' }
        } else if (current.direction === 'desc') {
          return { key, direction: null }
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const handleFilter = (key: string, value: any) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      if (value === undefined || value.length == 0) {
        delete newFilters[key]
      } else {
        newFilters[key] = value
      }
      // If no filters remain, ensure isFilterActive stays true
      // so the filter icons remain visible
      return newFilters
    })
  }

  const resetFilters = () => {
    setFilters({})
    setIsFilterActive(!isFilterActive)
  }

  const filteredAndSortedData = useMemo(() => {
    let filteredItems = [...data]

    // Only apply filters if there are active filters
    if (Object.keys(filters).length > 0) {
      filteredItems = data.filter((item) => {
        for (const [key, value] of Object.entries(filters)) {
          // Skip empty filters
          if (value === undefined || (Array.isArray(value) && value.length === 0)) {
            continue
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
            if (value.length === 0) {
              continue
            }
            if (!value.includes(String(item[key as keyof FutureMeetingTableData]))) {
              return false
            }
          }
          // Handle other filter types
          else if (value !== undefined && item[key as keyof FutureMeetingTableData] !== value) {
            return false
          }
        }
        return true
      })
    }

    // Apply sorting if active
    if (sortConfig.direction) {
      filteredItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    return filteredItems
  }, [data, filters, sortConfig])

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key])
  }, [columnVisibility])

  const getSortIcon = (columnKey: keyof FutureMeetingTableData) => {
    if (sortConfig.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="h-4 w-4 ml-2" />
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="h-4 w-4 ml-2" />
      }
    }
    return null
  }

  const getFilterIcon = (columnKey: string) => {
    if (!isFilterActive) return null
    if (filters[columnKey]) {
      return <Filter className="h-4 w-4 ml-2" />
    }
    return <ChevronDown className="h-4 w-4 ml-2" />
  }

  const facetedFilters = useMemo(() => {
    const facets: { [key: string]: { value: string; count: number }[] } = {}
    columns.forEach((column) => {
      if (column.filterable && column.type !== 'date') {
        const values = new Set(data.map((item) => String(item[column.key])))
        facets[column.key] = Array.from(values).map((value) => ({
          value,
          count: data.filter((item) => String(item[column.key]) === value).length,
        }))
      } else if (column.filterable && column.type === 'boolean') {
        const trueCount = data.filter((item) => item[column.key] === true).length
        const falseCount = data.filter((item) => item[column.key] === false).length
        facets[column.key] = [
          { value: '✓', count: trueCount },
          { value: '✗', count: falseCount },
        ]
      } else {
        const values = new Set(data.map((item) => String(item[column.key])))
        facets[column.key] =
          column.key === '_status'
            ? [
                {
                  value: 'פורסם',
                  count: data.filter(({ _status }) => _status === StatusType.Publish).length,
                },
                {
                  value: 'טיוטה',
                  count: data.filter(({ _status }) => _status === StatusType.Draft).length,
                },
              ]
            : Array.from(values).map((value) => ({
                value,
                count: data.filter((item) => String(item[column.key]) === value).length,
              }))
      }
    })
    return facets
  }, [data])

  return (
    <div className="space-y-4 text-right pr-10 pl-10" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <div className="relative w-1/3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש כללי..."
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
            className={cn('flex items-center', isFilterActive && 'bg-muted')}
          >
            <Filter className="h-4 w-4 mr-2" />
            סינון
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex justify-between items-center">
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
        <div className="rounded-md border">
          <div className="max-h-[calc(100vh-200px)] overflow-auto relative">
            <Table className="w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-gray-100">
                <TableRow className="bg-muted/50 border-b border-border">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className="text-right max-w-[200px] overflow-hidden text-ellipsis cursor-pointer"
                    >
                      <div className="flex items-center justify-start">
                        <span onClick={() => handleSort(column.key)}>{column.header}</span>
                        {getSortIcon(column.key)}
                        {column.filterable && (
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
                                facetedFilters[column.key]?.map(({ value, count }) => (
                                  <DropdownMenuCheckboxItem
                                    key={value}
                                    checked={(filters[column.key] || []).includes(value)}
                                    onCheckedChange={(checked) => {
                                      const currentFilters = filters[column.key] || []
                                      const newFilters = checked
                                        ? [...currentFilters, value]
                                        : currentFilters.filter((v: any) => v !== value)
                                      handleFilter(column.key, newFilters)
                                    }}
                                  >
                                    {value} ({count})
                                  </DropdownMenuCheckboxItem>
                                ))
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleFilter(column.key, 'all')}>
                                הסר סינון
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-1"></TableHead>
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
                        className="py-2 px-3 text-right whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                      >
                        {column.render ? column.render(row) : String(row[column.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="relative h-full">
                        <div className="absolute left-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 group-hover:bg-gray-200 transition-opacity whitespace-nowrap ">
                          {row.meetingInviteUrl && (
                            <a
                              href={row.meetingInviteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 space-x-reverse px-4 h-full hover:bg-muted/50 transition-colors"
                            >
                              <span className="text-sm text-foreground hover:text-blue-800">
                                זימון אסיפה
                              </span>
                            </a>
                          )}
                        </div>
                      </div>
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
