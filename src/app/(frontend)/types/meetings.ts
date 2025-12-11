import { MeetingState, StockOrigin } from '@/payload-types'
import { TreeCompanyType } from '@/types/companies'

export type MeetingTableDataType = {
  meetingIdPayload: string // Payload ID of the meeting
  meetingId: string
  agendas: AgendasType[] // סדר היום של האסיפה
  votingPercentage: number | null // אחוז ההצבעה של המשתש מתוך חברות המשתמש
  displayVotingRecommendation: boolean
  defaultVotingRecommendation: boolean
  companies: CompanyTableDate[]
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  stockSymbol: string //סימול
  stockName: string //שם נייר
  companyName: string //שם החברה
  stockTradable: boolean //האם נסחר
  stockOrigin: StockOrigin // מקור נייר הערך
  fromRelatedStock: boolean // ניירות עוקבים
  marketValue: number //שווי שוק
  nominalValue: number // ערך נקוב ליום קובע
  percentageHolding: number //אחוז החזקות
  holdingValueInMillions: number //שווי החזקה במיליונים
  meetingType: string //סוג האסיפה
  meetingDate: string //מועד האסיפה
  reference: string
  meetingState: MeetingState | null
  isDualStock: boolean //האם נייר כפול
  researchDocuments: UrlFilenameMap[] //מסמכי מחקר
  location: string //מיקום
  holdingsLimit: string //תאריך קובע
  proxyVotingDate: string //מועד מסירת ההצבעה
  meetingInviteUrl: string //זימון אסיפה
  comments: string // - חוות דעת - הערות ??
  electronicVotingEnabled: boolean //האם האסיפה מופיעה במערכת האלקטרונית?
  resultsConfirmationStatus: boolean //אימות תוצאות האסיפה
  committeeInitiated: boolean //האם פיננסי דורש ועדה?
  votes: any
  displayMode?: string
  selectedCompanyIds?: string[]
  labels: { id: string; label: string; color: string }[]
  relatedQuestions?: { id: string; questions: Array<{ id: string; questionText: string; defaultValue: boolean }> }
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
  originalStockIds?: any[]
  fromRelatedStock: boolean
}

export type FundType = {
  id: string
  holdingsCompanyName: string
  percentageHolding: number
  holdingValueInMillions: number
  nominalValue: number
  parentCompany?: TreeCompanyType // Parent company structure
  passiveFund?: boolean
  originalStockIds?: any[]
  fromRelatedStock: boolean
}

export type AgendasType = {
  id: string
  topicIndex: number
  text: string
  isRemovedFromAgenda: boolean
  privilegedMajority: boolean
  recommendation: recommendationType
  vote?: string
  result?: string
  simpleMajority?: boolean
  percentResult: number | null
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
  type: 'string' | 'number' | 'datetime' | 'boolean' | 'enum' | 'label' | 'other'
  filterable?: boolean
  positionCenter?: boolean
  render?: (row: T) => React.ReactNode
  renderHeader?: () => React.ReactNode
  defaultVisible?: boolean
  minWidth: number
  width?: number
  sortKey?: keyof T // Allow sorting by a different key than displayed
  options?: { label: string; value: string }[]
  isAlwaysVisible?: boolean
  // Optional custom search value producer for this column
  getSearchValue?: (row: T) => string
}

// Structure for faceted filters
export interface FacetedFilterItem {
  value: string
  count: number
  icon?: React.ReactNode
  translate?: string
  label?: React.ReactNode
}
// Structure for faceted filters
export interface FacetedFilterItemServer {
  value: string
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

export interface ClientPaginationProps {
  pageSize: number
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
  isLoading?: boolean
  onServerSort?: (field: string) => void
  onServerSearch?: (term: string) => void
  onServerFilter?: (field: string, values: string[]) => void
  onServerDateFilter?: (field: string, filter: DateFilterType) => void
  serverSideProcessing?: boolean
  initialSearchTerm?: string
  activeFilters?: Record<string, string[]>
  setActiveFilters?: (filters: Record<string, string[]>) => void
  tableHeightOffset?: number
  renderExpandedRowContent?: (row: T) => React.ReactNode // New prop
  expanderColumnKey?: keyof T
  searchOption?: boolean
  selectAll?: string
  removeAll?: string
  noLabel?: string
  displayMode?: 'companies' | 'agenda' // New prop for display mode
  selectedCompanyIds?: string[]
  createColumnsWithExpand?: (
    companiesExpandedRows: Record<string, boolean>,
    setCompaniesExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    agendasExpandedRows: Record<string, boolean> | undefined,
    setAgendasExpandedRows:
      | React.Dispatch<React.SetStateAction<Record<string, boolean>>>
      | undefined,
    data: MeetingTableDataType[],
  ) => Column<MeetingTableDataType>[]
  showExport?: boolean
  onExportExcel?: () => void
  isExporting?: boolean
  showCompanySelector?: boolean
  onCompanySelectionChange?: (selectedIds: string[]) => void
  getCompanySelectSummary?: () => string
  showViewModeToggle?: boolean
  viewMode?: 'companies' | 'agenda'
  onViewModeChange?: (mode: 'companies' | 'agenda') => void
}

export interface ServerDataTableProps<T extends Record<string, any>> extends DataTableProps<T> {
  pagination?: PaginationProps
}

export interface ClientDataTableProps<T extends Record<string, any>> extends DataTableProps<T> {
  pagination?: ClientPaginationProps
}

export interface UrlFilenameMap {
  url: string
  filename: string
  companies: string[]
}

export type MeetingWithCompanies = {
  meetingId: string
  companyIds: string[]
}

export type DateFilterType = {
  past: string
  future: string
  empty: boolean
  custom: boolean
  customDate: CustomDate
}

export type CustomDate = {
  startDate?: Date
  endDate?: Date
}

export type selectOptionType = {
  value: string
  label: string
}
