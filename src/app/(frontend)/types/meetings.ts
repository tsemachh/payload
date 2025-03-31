import { MeetingState } from '@/payload-types'

export type MeetingTableDataType = {
  meetingId: string
  companies: CompanyTableDate[]
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  stockSymbol: string //סימול
  stockName: string //שם נייר
  companyName: string //שם החברה
  stockTradable: boolean //האם נסחר
  marketValue: number //שווי שוק
  nominalValue: number // ערך נקוב
  percentageHolding: number //אחוז אחזקות
  holdingValueInMillions: number //שווי אחזקה במיליונים
  meetingType: string //סוג האסיפה
  meetingDate: string //מועד האסיפה
  reference: string
  meetingState: MeetingState | null
  location: string //מיקום
  holdingsLimit: string //תאריך קובע
  proxyVotingDate: string //מועד מסירת ההצבעה
  meetingInviteUrl: string //זימון אסיפה
  comments: string // - חוות דעת - הערות ??
  electronicVotingEnabled: boolean //האם האסיפה מופיעה במערכת האלקטרונית?
  resultsConfirmationStatus: boolean //אימות תוצאות האסיפה
  committeeInitiated: boolean //האם פיננסי דורש ועדה?
}

export type DateFilterOption = {
  value: string
  label: string
}

export type CompanyTableDate = {
  holdingsCompanyName: string
  percentageHolding: number
  holdingValueInMillions: number
  nominalValue: number
}

// Base column type for all tables
export interface Column<T> {
  key: keyof T
  header: string
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'enum'
  filterable?: boolean
  positionCenter?: boolean
  render?: (row: T) => React.ReactNode
  defaultVisible?: boolean
  minWidth: number
  width?: number
  sortKey?: keyof T // Allow sorting by a different key than displayed
  options?: { label: string; value: string }[]
}

// Structure for faceted filters
export interface FacetedFilterItem {
  value: string
  count: number
  icon?: React.ReactNode
  translate?: string
}
// Pagination props
export interface PaginationProps {
  pageSize: number
  totalItems: number
  totalPages: number
  currentPage?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}
// Data table props with generic type
export interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: Column<T>[]
  pastDateFilterOptions?: DateFilterOption[]
  futureDateFilterOptions?: DateFilterOption[]
  idField: keyof T
  defaultSortField?: keyof T
  defaultSortDirection?: 'asc' | 'desc'
  tableId?: string // For storing column visibility in localStorage
  renderRowActions?: (row: T) => React.ReactNode
  searchPlaceholder?: string
  filterLabel?: string
  columnsLabel?: string
  onlyFuture?: boolean
  pagination?: PaginationProps
  isLoading?: boolean
  onServerSort?: (field: string) => void
  onServerSearch?: (term: string) => void
  onServerFilter?: (field: string, values: string[]) => void
  serverSideProcessing?: boolean
  initialSearchTerm?: string
  activeFilters?: Record<string, string[]>
  setActiveFilters?: (filters: Record<string, string[]>) => void
}
