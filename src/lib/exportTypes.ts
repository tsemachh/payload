// Shared types and constants for Excel and PDF export

export interface ExportOptions {
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
  agendas: {
    text?: string
    recommendation?: {
      votingRecommendation?: string
    }
    vote?: string
    result?: string
    meetingResults?: string
    regularMajority?: string
    specialMajority?: string
    policyCompliance?: string
    conflictOfInterest?: string
    relatedParty?: string
    personalInterest?: string
    privilegedMajority?: boolean
    vPercentSpecial?: number
  }[]
}

// Shared constants
export const resultMapping: { [key: string]: string } = {
  '0': '---',
  '1': 'אושר',
  '2': 'לא אושר',
  '3': 'דיון',
}

// Shared column headers
export const SHARED_COLUMNS = {
  STOCK_NUMBER: 'מספר נייר',
  STOCK_NAME: 'שם נייר',
  MARKET_VALUE: `שווי שוק (מ' ₪)`,
  PERCENTAGE_HOLDING: 'החזקה (%)',
  HOLDING_VALUE: `שווי החזקה (מ' ₪)`,
  MEETING_DATE: 'מועד האסיפה',
  MEETING_TYPE: 'סוג האסיפה',
  COMPANY_NAME: 'שם החברה',
  SUBJECT: 'נושא',
  ADVISOR_RECOMMENDATION: 'המלצת גורם מייעץ',
  VOTE: 'הצבעה',
  MEETING_RESULTS: 'תוצאות האסיפה',
  REGULAR_MAJORITY: 'רוב רגיל',
  SPECIAL_MAJORITY: 'רוב מיוחד (%)',
  POLICY_COMPLIANCE: 'בהתאם למדיניות דירקטוריון ו/או וועדת השקעות',
  CONFLICT_OF_INTEREST: 'ניגוד עניינים',
  RELATED_PARTY: 'צד קשר',
  PERSONAL_INTEREST: 'עניין אישי',
} as const

// Company sub-headers for detailed view
export const COMPANY_SUB_HEADERS = [
  SHARED_COLUMNS.STOCK_NUMBER,
  SHARED_COLUMNS.STOCK_NAME,
  SHARED_COLUMNS.MARKET_VALUE,
  SHARED_COLUMNS.PERCENTAGE_HOLDING,
  SHARED_COLUMNS.HOLDING_VALUE,
  SHARED_COLUMNS.MEETING_DATE,
  SHARED_COLUMNS.MEETING_TYPE,
] as const

// Agenda headers
export const AGENDA_HEADERS = [
  SHARED_COLUMNS.SUBJECT,
  SHARED_COLUMNS.ADVISOR_RECOMMENDATION,
  SHARED_COLUMNS.VOTE,
  SHARED_COLUMNS.MEETING_RESULTS,
  SHARED_COLUMNS.REGULAR_MAJORITY,
  SHARED_COLUMNS.SPECIAL_MAJORITY,
  SHARED_COLUMNS.POLICY_COMPLIANCE,
  SHARED_COLUMNS.CONFLICT_OF_INTEREST,
  SHARED_COLUMNS.RELATED_PARTY,
  SHARED_COLUMNS.PERSONAL_INTEREST,
] as const

// Utility functions
export function formatNormalDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export function groupDataByMeeting(data: any[]): GroupedMeetingData[] {
  const groupedData = new Map<string, GroupedMeetingData>()
  data.forEach((item) => {
    const key = item.stockNumber
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        stockNumber: item.stockNumber,
        stockName: item.stockName,
        marketValue: item.marketValue,
        percentageHolding: item.percentageHolding,
        holdingValueInMillions: item.holdingValueInMillions,
        meetingDate: item.meetingDate,
        meetingType: item.meetingType,
        companyName: item.currentCompany?.name || item.companyName,
        agendas: item.agendas || [],
      })
    } else {
      const existing = groupedData.get(key)!
      existing.agendas = [...existing.agendas, ...(item.agendas || [])]
    }
  })
  return Array.from(groupedData.values())
}

export function booleanToText(value: any): string {
  if (value === true) return 'כן'
  if (value === false) return 'לא'
  return ''
}

// export function booleanToIcon(value: any): string {
//   if (value === true) return 'V'
//   if (value === false) return '-'
//   return ''
// }
// export function booleanToIcon(value: any): string {
//   if (value === true) return '✓' // סימן V יפה
//   if (value === false) return '✗' // סימן X יפה
//   return ''
// }

// אלטרנטיבות נוספות לסמלים:

// אפשרות 1 - סמלים עם יותר ניגודיות
export function booleanToIcon(value: any): string {
  if (value === true) return '✔️' // סימן V מודגש
  if (value === false) return '❌' // סימן X מודגש
  return ''
}

// אפשרות 2 - סמלים גיאומטריים
export function booleanToIconGeometric(value: any): string {
  if (value === true) return '●' // עיגול מלא (ירוק)
  if (value === false) return '○' // עיגול ריק (אדום)
  return ''
}
