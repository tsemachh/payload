import { ParticipationTableDataType, ParticipationAgendaType } from '../types'

// PDF Export interfaces
export interface PDFExportOptions {
  reportName: string
  dateRange: {
    startDate: Date
    endDate: Date
  }
  selectedCompaniesCount: number
  totalRecords: number
  selectedRecords: number
}

export interface GroupedMeetingData {
  stockNumber: string
  stockName: string
  marketValue: string
  percentageHolding: number
  holdingValueInMillions: number
  meetingDate: string
  meetingType: string
  companyName?: string
  agendas: ParticipationAgendaType[]
}

export interface TableColumn {
  key: string
  header: string
  width: number
  align: 'right' | 'center' | 'left'
  dataKey?: string
}

/**
 * Groups participation data by meeting (stockNumber)
 * Each group represents one meeting with multiple agenda items
 */
export function groupDataByMeeting(data: ParticipationTableDataType[]): GroupedMeetingData[] {
  const groupedData = new Map<string, GroupedMeetingData>()

  data.forEach((item) => {
    const key = item.stockNumber
    
    if (!groupedData.has(key)) {
      // Create new meeting group
      groupedData.set(key, {
        stockNumber: item.stockNumber,
        stockName: item.stockName,
        marketValue: item.marketValue,
        percentageHolding: item.percentageHolding,
        holdingValueInMillions: item.holdingValueInMillions,
        meetingDate: item.meetingDate,
        meetingType: item.meetingType,
        companyName: item.currentCompany?.name || item.companyName,
        agendas: item.agendas || []
      })
    } else {
      // If meeting already exists, merge agendas (shouldn't happen with proper data structure)
      const existing = groupedData.get(key)!
      existing.agendas = [...existing.agendas, ...(item.agendas || [])]
    }
  })

  return Array.from(groupedData.values())
}

export async function exportParticipationsToPDF(
  data: ParticipationTableDataType[],
  options: PDFExportOptions
): Promise<void> {
  // Implementation will be added in task 8
  console.log('PDF export functionality will be implemented')
}