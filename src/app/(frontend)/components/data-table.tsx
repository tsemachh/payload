'use client'

import { useState, useMemo } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown, Search, FileText, Check, X, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type React from 'react'
import { FutureMeetingTableData } from '../types'

interface Column {
  key: keyof FutureMeetingTableData | string
  header: string | React.ReactNode
  sortable?: boolean
  filterable?: boolean
  booleanFilterable?: boolean
  searchable?: boolean
  render?: (row: FutureMeetingTableData) => React.ReactNode
}

type BooleanFilterState = 'none' | 'true' | 'false'

const BooleanFilterButton = ({
  value,
  onChange,
}: {
  value: BooleanFilterState
  onChange: (value: BooleanFilterState) => void
}) => {
  const handleClick = () => {
    if (value === 'none') onChange('true')
    else if (value === 'true') onChange('false')
    else onChange('none')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0 hover:bg-muted', value !== 'none' && 'bg-primary/10')}
      onClick={handleClick}
    >
      {value === 'true' && <Check className="h-4 w-4" />}
      {value === 'false' && <X className="h-4 w-4" />}
      {value === 'none' && <div className="h-4 w-4 border rounded" />}
    </Button>
  )
}

const columns: Column[] = [
  // proofId
  {
    key: 'stockNumber',
    header: 'מס׳ נייר',
    searchable: true,
    render: (row) => <div className="min-w-[100px]">{row.stockNumber}</div>,
  },
  {
    key: 'stockType',
    header: 'סוג נייר',
    filterable: true,
    render: (row) => <div className="min-w-[100px]">{row.stockType}</div>,
  },
  {
    key: 'companyName',
    header: 'שם חברה',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.companyName}</div>,
  },
  {
    key: 'marketValue',
    header: 'שווי שוק (מיליוני ₪)',
    sortable: true,
    render: (row) =>
      new Intl.NumberFormat('he-IL').format(Number((row.marketValue / 1_000_000).toFixed(2))),
  },
  {
    key: 'meetingType',
    header: 'סוג אסיפה',
    filterable: true,
    render: (row) => <div className="min-w-[100px]">{row.meetingType}</div>,
  },
  {
    key: 'meetingDate',
    header: 'תאריך האסיפה',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.meetingDate}</div>,
  },
  {
    key: 'location',
    header: 'מיקום',
    render: (row) => (
      <div className="max-w-[200px] truncate" title={row.location as string}>
        {row.location}
      </div>
    ),
  },
  {
    key: 'holdingsLimit',
    header: 'מועד קובע',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.holdingsLimit}</div>,
  },
  {
    key: 'proxyVotingDate',
    header: 'תאריך מסירת הצבעות',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.proxyVotingDate}</div>,
  },
  {
    key: 'votingDocUrl',
    header: 'כתב הצבעה',
    render: (row) =>
      row.votingDocUrl ? (
        <a href={row.votingDocUrl} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4 text-primary" />
        </a>
      ) : null,
  },
  {
    key: 'meetingInviteUrl',
    header: 'זימון אסיפה',
    render: (row) =>
      row.meetingInviteUrl ? (
        <a href={row.meetingInviteUrl} target="_blank" rel="noopener noreferrer">
          <FileText className="h-4 w-4 text-primary" />
        </a>
      ) : null,
  },
  {
    key: 'comments',
    header: 'הערות',
    render: (row) => (
      <div className="max-w-[200px] truncate" title={row.location as string}>
        {row.location}
      </div>
    ),
  },
  {
    key: 'electronicVotingEnabled',
    header: 'האסיפה מופיעה במערכת האלק׳?',
    booleanFilterable: true,
    render: (row) =>
      row.electronicVotingEnabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  // resultsConfirmationStatus
  // relatedMeetingId
  {
    key: 'committeeInitiated',
    header: 'תאגיד פיננסי דורש ועדה',
    booleanFilterable: true,
    render: (row) =>
      row.committeeInitiated ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  // _status
]

interface DataTableProps {
  data: FutureMeetingTableData[]
}

export function DataTable({ data }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [filters, setFilters] = useState<{
    meetingType: string
    stockType: string
  }>({
    meetingType: '',
    stockType: '',
  })
  const [booleanFilters, setBooleanFilters] = useState<{
    [key: string]: BooleanFilterState
  }>({
    electronicVotingEnabled: 'none',
    committeeInitiated: 'none',
  })
  const [searchTerms, setSearchTerms] = useState<{
    stockNumber: string
    general: string
  }>({
    stockNumber: '',
    general: '',
  })
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>(
    Object.fromEntries(columns.map((col) => [col.key, true])),
  )
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => columnVisibility[String(column.key)])
  }, [columnVisibility])

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  const handleFilter = (key: 'meetingType' | 'stockType', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleBooleanFilter = (key: string, value: BooleanFilterState) => {
    setBooleanFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSearch = (key: 'stockNumber' | 'general', value: string) => {
    setSearchTerms((prev) => ({ ...prev, [key]: value }))
  }

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const filteredAndSortedData = useMemo(() => {
    let result = [...data]
    // Apply filters
    if (filters.meetingType && filters.meetingType !== 'all') {
      result = result.filter((item) => item.meetingType === filters.meetingType)
    }
    if (filters.stockType && filters.meetingType !== 'all') {
      result = result.filter((item) => item.stockType === filters.stockType)
    }

    // Apply boolean filters
    Object.entries(booleanFilters).forEach(([key, value]) => {
      if (value !== 'none') {
        result = result.filter((item) => {
          const boolValue = value === 'true'
          return item[key as keyof FutureMeetingTableData] === boolValue
        })
      }
    })

    // Apply searches
    if (searchTerms.stockNumber) {
      result = result.filter((item) =>
        item.stockNumber.toLowerCase().includes(searchTerms.stockNumber.toLowerCase()),
      )
    }
    if (searchTerms.general) {
      result = result.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(searchTerms.general.toLowerCase()),
        ),
      )
    }
    // Apply sorting
    if (sortConfig) {
      result.sort((a: FutureMeetingTableData, b: FutureMeetingTableData) => {
        const key = sortConfig.key as keyof FutureMeetingTableData
        let aValue = a[key]
        let bValue = b[key]

        // Special handling for date columns
        if (key === 'holdingsLimit' || key === 'proxyVotingDate' || key === 'meetingDate') {
          aValue = new Date(aValue as string).getTime()
          bValue = new Date(bValue as string).getTime()
        }

        // Special handling for numeric columns
        if (key === 'marketValue') {
          aValue = Number(aValue)
          bValue = Number(bValue)
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [data, sortConfig, filters, booleanFilters, searchTerms])

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש כללי..."
            value={searchTerms.general}
            onChange={(e) => handleSearch('general', e.target.value)}
            className="pr-10 text-right"
          />
        </div>
        <DropdownMenu open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex justify-between items-center"
              onClick={() => setIsColumnSelectorOpen((prev) => !prev)}
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
      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50 border-b border-border">
              {visibleColumns.map((column) => (
                <TableHead
                  key={`header-${String(column.key)}`}
                  className="text-right h-10 px-2 whitespace-nowrap"
                >
                  <div className="flex items-cente">
                    <span className="text-xs font-bold">{column.header}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="hover:bg-muted/50">
              {visibleColumns.map((column) => (
                <TableHead key={`filter-${String(column.key)}`} className="p-0">
                  <div className="px-2 py-2 flex flex-col items-end">
                    {column.searchable && (
                      <Input
                        placeholder={`חיפוש ${column.header}`}
                        value={searchTerms[column.key as keyof typeof searchTerms] || ''}
                        onChange={(e) =>
                          handleSearch(column.key as keyof typeof searchTerms, e.target.value)
                        }
                        className="h-8 text-xs text-right w-full"
                      />
                    )}
                    {column.filterable && (
                      <Select
                        value={filters[column.key as keyof typeof filters]}
                        onValueChange={(value) =>
                          handleFilter(column.key as keyof typeof filters, value)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs text-right w-full">
                          <SelectValue placeholder={`סנן ${column.header}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">הכל</SelectItem>
                          {Array.from(
                            new Set(
                              data.map((item) => item[column.key as keyof FutureMeetingTableData]),
                            ),
                          ).map((value) => (
                            <SelectItem key={String(value)} value={String(value)}>
                              {String(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {column.booleanFilterable && (
                      <div className="flex justify-between w-full">
                        <BooleanFilterButton
                          value={booleanFilters[String(column.key)]}
                          onChange={(value) => handleBooleanFilter(String(column.key), value)}
                        />
                      </div>
                    )}
                    {column.sortable && (
                      <Button
                        variant="ghost"
                        onClick={() => handleSort(String(column.key))}
                        className="h-8 w-full text-x"
                      >
                        <ArrowUpDown
                          className={cn(
                            'h-3 w-3',
                            sortConfig?.key === column.key &&
                              (sortConfig.direction === 'asc' ? 'rotate-180' : ''),
                          )}
                        />
                      </Button>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.map((row) => (
              <TableRow key={row.meetingId} className="hover:bg-muted">
                {visibleColumns.map((column) => (
                  <TableCell
                    key={`${row.meetingId}-${String(column.key)}`}
                    className="py-2 px-3 text-right whitespace-nowrap"
                  >
                    {column.render && column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
