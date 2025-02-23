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
import {
  ArrowUpDown,
  Search,
  Check,
  X,
  Settings2,
  Filter,
  ArrowUp,
  ArrowDown,
  FilterX,
} from 'lucide-react'
import type React from 'react'
import { StatusType, type FutureMeetingTableData } from '../types'
import { cn } from '@/lib/utils'

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
  // { key: 'marketValue', header: 'שווי שוק (מיליוני ₪)', type: 'number' },
  { key: 'meetingType', header: 'סוג אסיפה', type: 'string', filterable: true },
  { key: 'meetingDate', header: 'תאריך האסיפה', type: 'date' },
  { key: 'location', header: 'מיקום', type: 'string' },
  { key: 'holdingsLimit', header: 'מועד קובע', type: 'date' },
  { key: 'proxyVotingDate', header: 'תאריך מסירת הצבעות', type: 'date' },
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
    direction: 'asc' | 'desc'
  } | null>(null)
  const [filters, setFilters] = useState<{ [key: string]: Set<string> }>({})
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

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
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  const handleFilter = (key: keyof FutureMeetingTableData, value: string, checked: boolean) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      if (!newFilters[key]) {
        newFilters[key] = new Set()
      }
      if (checked) {
        newFilters[key].add(value)
      } else {
        newFilters[key].delete(value)
      }
      if (newFilters[key].size === 0) {
        delete newFilters[key]
      }
      return { ...newFilters }
    })
  }

  const removeFilter = (key: keyof FutureMeetingTableData) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return { ...newFilters }
    })
  }

  const getFilterIcon = (columnKey: keyof FutureMeetingTableData) => {
    if (filters[columnKey] || sortConfig?.key === columnKey) {
      return <FilterX className="h-4 w-4 text-primary" />
    }
    return <Filter className="h-4 w-4" />
  }

  const filteredAndSortedData = useMemo(() => {
    let result = [...data]
    // Apply filters
    Object.entries(filters).forEach(([key, values]) => {
      const column = columns.find((col) => col.key === key)
      if (column && column.type === 'boolean') {
        result = result.filter((item) => {
          const itemValue = item[key as keyof FutureMeetingTableData]
          return (values.has('✓') && itemValue === true) || (values.has('✗') && itemValue === false)
        })
      } else {
        result = result.filter((item) =>
          values.has(String(item[key as keyof FutureMeetingTableData])),
        )
      }
    })
    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key]
        const bValue = b[sortConfig.key]
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [data, sortConfig, filters])

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[column.key])
  }, [columnVisibility])

  const getSortIcon = (columnKey: keyof FutureMeetingTableData) => {
    if (sortConfig?.key === columnKey) {
      return sortConfig.direction === 'asc' ? (
        <ArrowUp className="h-4 w-4" />
      ) : (
        <ArrowDown className="h-4 w-4" />
      )
    }
    return <ArrowUpDown className="h-4 w-4" />
  }

  const facetedFilters = useMemo(() => {
    const facets: { [key: string]: { value: string; count: number }[] } = {}
    columns.forEach((column) => {
      if (column.filterable) {
        if (column.type === 'boolean') {
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
      }
    })
    return facets
  }, [data])

  return (
    <div className="space-y-4 text-right pr-10 pl-10 " dir="rtl">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex justify-between items-center w-1/5">
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

      <div className="bg-background">
        <div className="rounded-md border">
          <div className="max-h-[calc(100vh-200px)] overflow-auto relative">
            <Table className="w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-gray-100">
                <TableRow className="bg-muted/50 border-b border-border">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        'text-right max-w-[200px] overflow-hidden text-ellipsis',
                        openDropdown === column.key ? 'bg-gray-200' : '',
                      )}
                    >
                      <div className="flex items-center justify-start">
                        <span>{column.header}</span>
                        <DropdownMenu
                          onOpenChange={(open) => setOpenDropdown(open ? column.key : null)}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {getFilterIcon(column.key)}{' '}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent style={{ direction: 'rtl' }} align="center">
                            <DropdownMenuItem onClick={() => handleSort(column.key)}>
                              <span>מיון</span>
                              {getSortIcon(column.key)}
                            </DropdownMenuItem>
                            {column.filterable && (
                              <>
                                <DropdownMenuSeparator />
                                {facetedFilters[column.key].map(({ value, count }) => (
                                  <DropdownMenuCheckboxItem
                                    key={value}
                                    checked={filters[column.key]?.has(value)}
                                    onCheckedChange={(checked) =>
                                      handleFilter(column.key, value, checked)
                                    }
                                  >
                                    {value} ({count})
                                  </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => removeFilter(column.key)}>
                                  הסר סינון
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
