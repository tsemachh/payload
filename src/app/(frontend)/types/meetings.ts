import { MeetingState, StockOrigin } from '@/payload-types'
import { TreeCompanyType } from '@/types/companies'

export type MeetingTableDataType = {
  meetingIdPayload: string // Payload ID of the meeting
  meetingId: string
  agendas: AgendasType[]
  companies: CompanyTableDate[]
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  stockSymbol: string //סימול
  stockName: string //שם נייר
  companyName: string //שם החברה
  stockTradable: boolean //האם נסחר
  stockOrigin: StockOrigin // מקור נייר הערך
  marketValue: number //שווי שוק
  nominalValue: number // ערך נקוב ליום קובע
  percentageHolding: number //אחוז אחזקות
  holdingValueInMillions: number //שווי אחזקה במיליונים
  meetingType: string //סוג האסיפה
  meetingDate: string //מועד האסיפה
  reference: string
  meetingState: MeetingState | null
  researchDocuments: UrlFilenameMap[] //מסמכי מחקר
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
  id: string
  percentageHolding: number
  holdingValueInMillions: number
  nominalValue: number
  funds: FundType[]
}
export type FundType = {
  id: string
  holdingsCompanyName: string
  percentageHolding: number
  holdingValueInMillions: number
  nominalValue: number
  parentCompany?: TreeCompanyType // Parent company structure
}

export type AgendasType = {
  id: string
  text: string
  isRemovedFromAgenda: boolean
  privilegedMajority: boolean
  recommendation: recommendationType
}
export type recommendationType = {
  votingRecommendation: string
  recommendationExplanation: string
}

// Base column type for all tables
export interface Column<T> {
  key: string
  header: string
  noHeader?: boolean
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'enum' | 'other'
  filterable?: boolean
  positionCenter?: boolean
  render?: (row: T) => React.ReactNode
  defaultVisible?: boolean
  minWidth: number
  width?: number
  sortKey?: keyof T // Allow sorting by a different key than displayed
  options?: { label: string; value: string }[]
  isAlwaysVisible?: boolean
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
  filterOption?: boolean
  filterLabel?: string
  columnsOption?: boolean
  columnsLabel?: string
  defaultVisibleColumns?: string[]
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
  tableHeightOffset?: number
}

export interface UrlFilenameMap {
  url: string
  filename: string
}
