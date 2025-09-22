import { ChevronDown, ChevronLeft } from 'lucide-react'
import { calculatePrecedingColumnsWidth } from '../helpers/utils-data-table'
import { Column, CompanyTableDate, MeetingTableDataType } from '../types/meetings'
import { Button } from '../components/ui/button'

// Function to display a button for companies in a meeting
export function renderCompaniesCell<T>(
  row: T,
  companiesExpandedRows: Record<string, boolean>,
  setCompaniesExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  if ((row as any).companies?.length === 0) return null
  const companyIds: string[] = ((row as any).companies as CompanyTableDate[])?.map(
    (company) => company.id,
  )
  return (
    <div className="flex items-center justify-start w-[20px] p-0 m-0">
      <Button
        variant="icon"
        size="sm"
        className="p-0 h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          toggleRowExpansion((row as any).meetingId, setCompaniesExpandedRows)
          toggleMultipleRows(companyIds, setFundsExpandedRows, true)
        }}
      >
        {companiesExpandedRows[(row as any).meetingId] ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
      <span className="mr-1">{(row as any).companies?.length || 0}</span>
    </div>
  )
}
export function renderAgendaCell<T>(
  row: T,
  agendasExpandedRows: Record<string, boolean>,
  setAgendasExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const agendas = (row as any).agendas
  if (!agendas || agendas.length === 0) return null

  return (
    <div className="flex items-center justify-start w-[20px] p-0 m-0">
      <Button
        variant="icon"
        size="sm"
        className="p-0 h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          setAgendasExpandedRows((prev) => ({
            ...prev,
            [(row as any).meetingId]: !prev[(row as any).meetingId],
          }))
        }}
      >
        {agendasExpandedRows[(row as any).meetingId] ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
      <span className="mr-1">{agendas?.length || 0}</span>
    </div>
  )
}

// Function to display a button for funds within a company
export function renderFundsCell(
  company: CompanyTableDate,
  companyName: string,
  fundsExpandedRows: Record<string, boolean>,
  setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  visibleColumns?: Column<any>[],
) {
  if (company.funds?.length === 0) return companyName

  return (
    <div
      className="flex items-center justify-start p-0 m-0 mr-3"
      style={{
        maxWidth: calculatePrecedingColumnsWidth(
          visibleColumns as Column<MeetingTableDataType>[],
          company,
        ),
      }}
    >
      <Button
        variant="icon"
        size="sm"
        className="p-0 h-6 w-6"
        onClick={(e) => {
          e.stopPropagation()
          toggleRowExpansion(company.id, setFundsExpandedRows)
        }}
      >
        {fundsExpandedRows[company.id] ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
      <span className="truncate ">
        <span className="ml-4">{company.funds?.length}</span>
        {companyName}
      </span>
    </div>
  )
}

function toggleRowExpansion(
  id: string,
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  setExpanded((prev) => ({
    ...prev,
    [id]: !prev[id],
  }))
}

function toggleMultipleRows(
  ids: string[],
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  expand: boolean,
) {
  setExpanded((prev) => {
    const updated = { ...prev }
    ids?.forEach((id) => {
      updated[id] = expand
    })
    return updated
  })
}

// Function to expand/collapse all companies
export function toggleAllCompanies(
  data: any[],
  companiesExpandedRows: Record<string, boolean>,
  setCompaniesExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setFundsExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const allMeetingIds = data.map((row) => row.meetingId)
  const allCompanyIds = data.flatMap(
    (row) => row.companies?.map((company: any) => company.id) || [],
  )

  // Check if all are expanded
  const allExpanded = allMeetingIds.every((id) => companiesExpandedRows[id])

  // Toggle all to opposite state
  const newState = !allExpanded

  setCompaniesExpandedRows((prev) => {
    const updated = { ...prev }
    allMeetingIds.forEach((id) => {
      updated[id] = newState
    })
    return updated
  })

  // Also expand/collapse all funds when expanding/collapsing companies
  setFundsExpandedRows((prev) => {
    const updated = { ...prev }
    allCompanyIds.forEach((id) => {
      updated[id] = newState
    })
    return updated
  })
}

// Function to expand/collapse all agendas
export function toggleAllAgendas(
  data: any[],
  agendasExpandedRows: Record<string, boolean>,
  setAgendasExpandedRows: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const allMeetingIds = data.map((row) => row.meetingId)

  // Check if all are expanded
  const allExpanded = allMeetingIds.every((id) => agendasExpandedRows[id])

  // Toggle all to opposite state
  const newState = !allExpanded

  setAgendasExpandedRows((prev) => {
    const updated = { ...prev }
    allMeetingIds.forEach((id) => {
      updated[id] = newState
    })
    return updated
  })
}
