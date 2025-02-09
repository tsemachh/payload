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
import type { Meeting as Assembly } from '@/payload-types'
import type React from 'react'

interface Column {
  key: keyof Assembly | string
  header: string | React.ReactNode
  sortable?: boolean
  filterable?: boolean
  booleanFilterable?: boolean
  searchable?: boolean
  render?: (row: Assembly) => React.ReactNode
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
  {
    key: 'meetingId',
    header: 'חשבון',
    searchable: true,
  /*  render: (row) => (row.meetingId ? row.meetingId.replace(/\D/g, '') : ''),*/
  },
  {
    key: 'securityNumber',
    header: 'מס׳ נייר',
    searchable: true,
  },
  {
    key: 'securityType',
    header: 'סוג נייר',
    filterable: true,
  },
  {
    key: 'companyName',
    header: 'שם חברה',
    sortable: true,
  },
  {
    key: 'registredValue',
    header: (
      <>
        שווי שוק
        <br />
        (מיליוני ₪)
      </>
    ),
    sortable: true,
/*
    render: (row) => new Intl.NumberFormat('he-IL').format(row.registredValue),
*/
  },
  {
    key: 'meetingType',
    header: 'סוג אסיפה',
    filterable: true,
  },
  {
    key: 'proxyStatementDate',
    header: 'מועד קובע',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.proxyStatementDate}</div>,
  },
  { key: 'recordTime', header: 'שעה' },
/*  {
    key: 'votingSubmissionDate',
    header: 'תאריך מסירת הצבעות',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.votingSubmissionDate}</div>,
  },*/
  { key: 'votingSubmissionTime', header: 'שעה' },
  {
    key: 'meetingDate',
    header: 'תאריך האסיפה',
    sortable: true,
    render: (row) => <div className="min-w-[100px]">{row.meetingDate}</div>,
  },
  { key: 'assemblyTime', header: 'שעה' },
/*  {
    key: 'holdingPercentage',
    header: 'אחזקה (%)',
    sortable: true,
    render: (row) => `${row.holdingPercentage.toFixed(2)}%`,
  },*/
  // {
  //   key: 'holdingValue',
  //   header: (
  //     <>
  //       שווי אחזקה
  //       <br />
  //       (מיליוני ₪)
  //     </>
  //   ),
  //   sortable: true,
  //   render: (row) => new Intl.NumberFormat('he-IL').format(row.holdingValue),
  // },
  {
    key: 'location',
    header: 'מיקום',
    render: (row) => (
      <div className="max-w-[200px] truncate" title={row.location as string}>
        {row.location}
      </div>
    ),
  },
/*  {
    key: 'opinion',
    header: 'חוות דעת',
    render: (row) =>
      row.opinion.exists && (
        <FileText className={cn('h-4 w-4', !row.opinion.viewed && 'font-bold text-primary')} />
      ),
  },*/
/*  {
    key: 'votingPaper',
    header: 'כתב הצבעה',
    render: (row) =>
      row.votingPaper.exists && (
        <FileText className={cn('h-4 w-4', !row.votingPaper.viewed && 'font-bold text-primary')} />
      ),
  },*/
/*  {
    key: 'assemblyInvitation',
    header: 'זימון אסיפה',
    render: (row) =>
      row.assemblyInvitation.exists && (
        <FileText
          className={cn('h-4 w-4', !row.assemblyInvitation.viewed && 'font-bold text-primary')}
        />
      ),
  },*/
  /*{
    key: 'votingReceived',
    header: 'התקבלה הצבעה בעמדה',
    booleanFilterable: true,
    render: (row) =>
      row.votingReceived ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  {
    key: 'inElectronicSystem',
    header: 'האסיפה מופיעה במערכת האלק׳?',
    booleanFilterable: true,
    render: (row) =>
      row.inElectronicSystem ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },
  {
    key: 'requiresFinancialCommittee',
    header: 'תאגיד פיננסי דורש ועדה',
    booleanFilterable: true,
    render: (row) =>
      row.requiresFinancialCommittee ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />,
  },*/
]

interface DataTableProps {
  data: Assembly[]
}

export function DataTable({ data }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [filters, setFilters] = useState<{
    assemblyType: string
    securityType: string
  }>({
    assemblyType: '',
    securityType: '',
  })
  const [booleanFilters, setBooleanFilters] = useState<{
    [key: string]: BooleanFilterState
  }>({
    votingReceived: 'none',
    inElectronicSystem: 'none',
    requiresFinancialCommittee: 'none',
  })
  const [searchTerms, setSearchTerms] = useState<{
    accountNumber: string
    securityNumber: string
    general: string
  }>({
    accountNumber: '',
    securityNumber: '',
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

  const handleFilter = (key: 'assemblyType' | 'securityType', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleBooleanFilter = (key: string, value: BooleanFilterState) => {
    setBooleanFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSearch = (key: 'accountNumber' | 'securityNumber' | 'general', value: string) => {
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

/*    // Apply filters
    if (filters.assemblyType) {
      result = result.filter((item) => item.assemblyType === filters.assemblyType)
    }
    if (filters.securityType) {
      result = result.filter((item) => item.securityType === filters.securityType)
    }*/

    // Apply boolean filters
    Object.entries(booleanFilters).forEach(([key, value]) => {
      if (value !== 'none') {
        result = result.filter((item) => {
          const boolValue = value === 'true'
          return item[key as keyof Assembly] === boolValue
        })
      }
    })

    // Apply searches
  /*  if (searchTerms.accountNumber) {
      result = result.filter((item) =>
        item.accountNumber.toLowerCase().includes(searchTerms.accountNumber.toLowerCase()),
      )
    }
    if (searchTerms.securityNumber) {
      result = result.filter((item) =>
        item.securityNumber.toLowerCase().includes(searchTerms.securityNumber.toLowerCase()),
      )
    }*/
    if (searchTerms.general) {
      result = result.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(searchTerms.general.toLowerCase()),
        ),
      )
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a: Assembly, b: Assembly) => {
        /*
        const key = sortConfig.key as keyof Assembly
        let aValue = a[key]
        let bValue = b[key]

     // Special handling for date columns
        if (key === 'recordDate' || key === 'votingSubmissionDate' || key === 'assemblyDate') {
          aValue = new Date(aValue as string).getTime()
          bValue = new Date(bValue as string).getTime()
        }

        // Special handling for numeric columns
        if (key === 'holdingPercentage' || key === 'holdingValue' || key === 'marketValue') {
          aValue = Number(aValue)
          bValue = Number(bValue)
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1*/
        return 0
      })
    }

    return result
  }, [data, sortConfig, filters, booleanFilters, searchTerms])

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <DropdownMenu open={isColumnSelectorOpen} onOpenChange={setIsColumnSelectorOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex justify-between items-center"
              onClick={() => setIsColumnSelectorOpen((prev) => !prev)}
            >
              <span>הצג/הסתר עמודות</span>
              <Settings2 className="h-4 w-4 mr-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] text-right" dir="rtl">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={String(column.key)}
                checked={columnVisibility[String(column.key)]}
                onCheckedChange={() => toggleColumnVisibility(String(column.key))}
                onSelect={(event) => event.preventDefault()}
                className="text-right"
              >
                {typeof column.header === 'string' ? column.header : 'עמודה'}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש כללי..."
            value={searchTerms.general}
            onChange={(e) => handleSearch('general', e.target.value)}
            className="pr-10 text-right"
          />
        </div>
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
                          <SelectItem value="default">הכל</SelectItem>
                          {Array.from(
                            new Set(data.map((item) => item[column.key as keyof Assembly])),
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
              <TableRow key={row.id} className="hover:bg-muted">
                {visibleColumns.map((column) => (
                  <TableCell
                    key={`${row.id}-${String(column.key)}`}
                    className="py-2 px-3 text-right whitespace-nowrap"
                  >
                    {column.render ? column.render(row) : row[column.key as keyof Meeting]}
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
