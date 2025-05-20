import { MeetingState } from '@/payload-types'

export type MeetingTableDataType = {
  meetingId: string
  agendas: AgendasType[]
  companies: CompanyTableDate[]
  stockNumber: string //מספר נייר
  stockType: string //סוג נייר
  stockSymbol: string //סימול
  stockName: string //שם נייר
  companyName: string //שם החברה
  stockTradable: boolean //האם נסחר
  marketValue: number //שווי שוק
  nominalValue: number // ערך נקוב ליום קובע
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

export type AgendasType = {
  id: string
  text: string
  isRemovedFromAgenda: boolean
  privilegedMajority: boolean
  recommendation: string
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

export type VoteDataType = {
  generalVotingData: GeneralVotingData
  voterNotes: string
  userVotes: UserVote[]
}

export type GeneralVotingData = {
  isInterested: boolean | null
  isSeniorOfficial: boolean | null
  isInstitutionalInvestor: boolean | null
  interestedExplanation?: string
  seniorOfficialExplanation?: string
}
export type UserVote = {
  subjectId: string
  choice: VoteChoice
  questions: AgendaQuestionsType
}
export type AgendaQuestionsType = {
  hasConflictOfInterest: boolean | null
  isRelatedParty: boolean | null
  isInvestmentCommittee: boolean | null
  hasPersonalInterest: boolean | null
  conflictOfInterestExplanation?: string
  relatedPartyExplanation?: string
  personalInterestExplanation?: string
}
export type VoteChoice = '----' | 'בעד' | 'נגד' | 'נמנע' | 'אין חובת השתתפות' | 'לא משתתף' | null
