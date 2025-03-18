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
} from 'lucide-react'
import type React from 'react'
import { cn } from '@/lib/utils'
import { escapeRegExp } from '../helpers/utils'
import { v4 as uuidv4 } from 'uuid'

// Base column type for all tables
export interface Column<T> {
  key: keyof T
  header: string
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'enum'
  positionCenter?: boolean
  render?: (row: T) => React.ReactNode
  defaultVisible?: boolean
  width?: number
  sortKey?: keyof T // Allow sorting by a different key than displayed
}

// Pagination props
export interface PaginationProps {
  pageSize: number
  totalItems: number
  totalPages: number
  currentPage?: number
  onPageChange?: (page: number) => void
}

// Data table props with generic type
export interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: Column<T>[]
  idField: keyof T
  defaultSortField?: keyof T
  defaultSortDirection?: 'asc' | 'desc'
  tableId?: string // For storing column visibility in localStorage
  renderRowActions?: (row: T) => React.ReactNode
  searchPlaceholder?: string
  columnsLabel?: string
  pagination?: PaginationProps
  isLoading?: boolean
  onServerSort?: (field: string) => void
  onServerSearch?: (term: string) => void
  initialSearchTerm?: string
}

export function DataTableServer<T extends Record<string, any>>({
  data = [],
  columns,
  idField,
  defaultSortField,
  defaultSortDirection = 'desc',
  tableId = 'default-table',
  renderRowActions,
  searchPlaceholder = 'חיפוש כללי...',
  columnsLabel = 'עמודות',
  pagination,
  isLoading = false,
  onServerSort,
  onServerSearch,
  initialSearchTerm = '',
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(pagination?.currentPage || 1)

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    pagination?.onPageChange?.(page)
  }
  
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T
    direction: 'asc' | 'desc'
  }>({
    key: (defaultSortField || columns[0].key) as keyof T,
    direction: defaultSortDirection,
  })
  
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({})
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)

  // Update searchTerm when initialSearchTerm changes
  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  useEffect(() => {
    // Load column visibility from localStorage
    const storageKey = `columnVisibility-${tableId}`
    const loadColumnVisibility = () => {
      const storedColumns = localStorage.getItem(storageKey)
      if (storedColumns) {
        try {
          const parsedColumns = JSON.parse(storedColumns)
          const validColumns = columns.map((col) => String(col.key))
          const filteredColumns = parsedColumns.filter((col: string) => validColumns.includes(col))

          if (filteredColumns.length !== parsedColumns.length) {
            localStorage.setItem(storageKey, JSON.stringify(filteredColumns))
          }

          const newVisibility = Object.fromEntries(
            columns.map((col) => [String(col.key), filteredColumns.includes(String(col.key))]),
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
      setColumnVisibility(
        Object.fromEntries(columns.map((col) => [String(col.key), col.defaultVisible !== false])),
      )
    }
    
    loadColumnVisibility()
  }, [columns, tableId])

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

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    // If server-side processing is enabled, skip client-side filtering and sorting
      return [...data]
  }, [data, searchTerm, sortConfig, visibleColumns, columns])

  // Handle sort
  const handleSort = useCallback((key: keyof T) => {
    if (onServerSort) {
      // Update the sort config UI
      setSortConfig((current) => {
        const newDirection = current.key === key 
          ? (current.direction === 'asc' ? 'desc' : 'asc')
          : 'asc';
        return { key, direction: newDirection };
      });
      
      // Use server-side sorting
      onServerSort(key as string);
    } 
  }, [onServerSort])

  // Highlight search term in text
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

  // Get sort icon for column header
  const getSortIcon = (columnKey: keyof T) => {
    if (isLoading && sortConfig.key === columnKey) {
      return (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
      )
    } else if (sortConfig.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        return <ArrowUp className="h-4 w-4" />
      } else if (sortConfig.direction === 'desc') {
        return <ArrowDown className="h-4 w-4" />
      }
    }
    return null
  }

  // Render the data table
  return (
    <div className="space-y-4 text-right pr-10 pl-10" dir="rtl">
      <div className="flex justify-between items-center space-x-4 space-x-reverse w-full">
        <div className="relative w-1/3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {searchTerm && (
            <X
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground cursor-pointer z-10"
              onClick={() => {
                setSearchTerm('');
                if (onServerSearch) {
                  onServerSearch('');
                }
              }}
            />
          )}
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              const newValue = e.target.value;
              setSearchTerm(newValue);
              if (onServerSearch) {
                // Use debounce for server-side search
                const delayDebounceFn = setTimeout(() => {
                  onServerSearch(newValue.trim());
                }, 500);
                return () => clearTimeout(delayDebounceFn);
              }
            }}
            className="pr-10 text-right"
            disabled={isLoading}
          />
        </div>
        <div className="flex space-x-2 space-x-reverse">
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

      <div className="bg-background relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
              <p className="text-sm text-muted-foreground">טוען נתונים...</p>
            </div>
          </div>
        )}
        <div className="rounded-md border cursor-default">
          <div className="max-h-[calc(100vh-300px)] overflow-auto relative">
            <Table className=" w-full border-collapse relative" dir="rtl">
              <TableHeader className="sticky top-0 bg-background z-20 bg-secondary">
                <TableRow className="bg-muted border-b border-border hover:bg-muted/80">
                  {visibleColumns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn('text-right overflow-hidden text-ellipsis')}
                      style={{
                        maxWidth: column.width ? `${column.width}px  !important` : '200px',
                        width: column.width ? `${column.width}px  !important` : 'auto',
                      }}
                    >
                      <div className="flex items-center justify-start">
                        <span 
                          className={`${isLoading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`} 
                          onClick={() => !isLoading && handleSort(column.key)}
                        >
                          {column.header}
                        </span>
                        <span 
                          className={`${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`} 
                          onClick={() => !isLoading && handleSort(column.key)}
                        >
                          {getSortIcon(column.key)}
                        </span>
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
                        maxWidth: column.width ? `${column.width}px  !important` : '200px',
                        width: column.width ? `${column.width}px  !important` : 'auto',
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
                        : highlightText(String(row[column.key] ?? ''), searchTerm)}
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

      {pagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            סה&quot;כ {pagination.totalItems} פריטים
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="min-w-[80px]"
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                  <span>טוען...</span>
                </div>
              ) : (
                'הקודם'
              )}
            </Button>
            <div className="text-sm font-medium min-w-[120px] text-center">
              {isLoading ? (
                <div className="flex items-center justify-center gap-1">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                  <span>טוען...</span>
                </div>
              ) : (
                `עמוד ${currentPage} מתוך ${pagination.totalPages}`
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(currentPage + 1, pagination.totalPages))}
              disabled={currentPage === pagination.totalPages || isLoading}
              className="min-w-[80px]"
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                  <span>טוען...</span>
                </div>
              ) : (
                'הבא'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}