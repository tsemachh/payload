import ExcelJS from 'exceljs'
import { resultMapping } from '@/app/(frontend)/participations/utils/pdfExport'
import { logger } from '@/lib/logger'

// Interfaces for Excel export (reusing from PDF generator)
export interface ExcelExportOptions {
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

// Excel row data interface for flattened structure
interface ExcelRowData {
  rowNumber: number
  stockNumber: string
  stockName: string
  marketValue: string
  percentageHolding: number
  holdingValueInMillions: number
  meetingDate: string
  meetingType: string
  companyName?: string
  agendaText: string
  recommendation: string
  vote: string
  result: string
  regularMajority: string
  specialMajority: string
  policyCompliance: string
  conflictOfInterest: string
  relatedParty: string
  personalInterest: string
}

function formatNormalDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function groupDataByMeeting(data: any[]): GroupedMeetingData[] {
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

function transformDataToExcelRows(groupedData: GroupedMeetingData[]): ExcelRowData[] {
  const rows: ExcelRowData[] = []
  let rowNumber = 1

  groupedData.forEach((meeting) => {
    if (meeting.agendas.length === 0) {
      // If no agendas, create a single row with meeting data
      rows.push({
        rowNumber: rowNumber++,
        stockNumber: meeting.stockNumber,
        stockName: meeting.stockName,
        marketValue: meeting.marketValue,
        percentageHolding: meeting.percentageHolding,
        holdingValueInMillions: meeting.holdingValueInMillions,
        meetingDate: meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
        meetingType: meeting.meetingType,
        companyName: meeting.companyName,
        agendaText: '',
        recommendation: '',
        vote: '',
        result: '',
        regularMajority: '',
        specialMajority: '',
        policyCompliance: '',
        conflictOfInterest: '',
        relatedParty: '',
        personalInterest: '',
      })
    } else {
      // Create a row for each agenda item
      meeting.agendas.forEach((agenda) => {
        const booleanToText = (value: any): string => {
          if (value === true) return 'כן'
          if (value === false) return 'לא'
          return ''
        }

        rows.push({
          rowNumber: rowNumber++,
          stockNumber: meeting.stockNumber,
          stockName: meeting.stockName,
          marketValue: meeting.marketValue,
          percentageHolding: meeting.percentageHolding,
          holdingValueInMillions: meeting.holdingValueInMillions,
          meetingDate: meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
          meetingType: meeting.meetingType,
          companyName: meeting.companyName,
          agendaText: agenda.text || '',
          recommendation:
            agenda.recommendation?.votingRecommendation ||
            '',
          vote: agenda.vote || '',
          result: agenda.result
            ? resultMapping[agenda.result] || agenda.result
            : agenda.meetingResults || '',
          regularMajority: booleanToText(!agenda.privilegedMajority),
          specialMajority:
            agenda.privilegedMajority && agenda.vPercentSpecial ? `${agenda.vPercentSpecial}%` : '',
          policyCompliance: booleanToText(agenda.policyCompliance),
          conflictOfInterest: booleanToText(agenda.conflictOfInterest),
          relatedParty: booleanToText(agenda.relatedParty),
          personalInterest: booleanToText(agenda.personalInterest),
        })
      })
    }
  })

  return rows
}

export async function generateParticipationsExcel(
  data: any[],
  options: ExcelExportOptions,
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('דוח השתתפות באסיפות')
    worksheet.views = [{ rightToLeft: true }]

    // Group and transform data
    const groupedData = groupDataByMeeting(data)
    const excelRows = transformDataToExcelRows(groupedData)

    if (excelRows.length === 0) {
      // Create empty worksheet with headers only
      const headers = ['אין נתונים להצגה']
      worksheet.addRow(headers)
      return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    // Define column headers in Hebrew
    const headers = [
      'מס״ד',
      'מספר נייר',
      'שם נייר',
      'שווי שוק (מ׳ ₪)',
      'אחזקה (%)',
      'שווי אחזקה (מ׳ ₪)',
      'מועד האסיפה',
      'סוג האסיפה',
      ...(options.selectedCompaniesCount > 1 ? ['שם החברה'] : []),
      'נושא',
      'המלצת גורם מייעץ',
      'הצבעה',
      'תוצאות האסיפה',
      'רוב רגיל',
      'רוב מיוחד (%)',
      'בהתאם למדיניות דירקטוריון ו/או וועדת השקעות',
      'ניגוד עניינים',
      'צד קשר',
      'עניין אישי',
    ]

    // Add title rows
    const titleRow = worksheet.addRow([`דו"ח השתתפות באסיפות - ${options.reportName}`])
    titleRow.font = { bold: true, size: 14 }
    titleRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(1, 1, 1, headers.length)

    const dateRangeText = `${formatNormalDate(options.dateRange.startDate)} - ${formatNormalDate(options.dateRange.endDate)}`
    const dateRow = worksheet.addRow([dateRangeText])
    dateRow.font = { bold: true, size: 12 }
    dateRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(2, 1, 2, headers.length)

    // Add empty row for spacing
    worksheet.addRow([])

    // Add headers
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }, // Light blue background
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

    // Add data rows
    excelRows.forEach((row) => {
      const dataRow = [
        row.rowNumber,
        row.stockNumber,
        row.stockName,
        row.marketValue,
        row.percentageHolding,
        row.holdingValueInMillions,
        row.meetingDate,
        row.meetingType,
        ...(options.selectedCompaniesCount > 1 ? [row.companyName] : []),
        row.agendaText,
        row.recommendation,
        row.vote,
        row.result,
        row.regularMajority,
        row.specialMajority,
        row.policyCompliance,
        row.conflictOfInterest,
        row.relatedParty,
        row.personalInterest,
      ]

      const excelRow = worksheet.addRow(dataRow)
      excelRow.alignment = { horizontal: 'right', vertical: 'middle' }
    })

    // Auto-fit columns
    worksheet.columns.forEach((column, index) => {
      if (column && column.eachCell) {
        let maxLength = 0
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 0
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
        column.width = Math.min(Math.max(maxLength + 2, 10), 50) // Min 10, Max 50
      }
    })

    // Add borders to all cells with data
    const lastRow = worksheet.rowCount
    const lastCol = headers.length

    for (let row = 4; row <= lastRow; row++) {
      for (let col = 1; col <= lastCol; col++) {
        const cell = worksheet.getCell(row, col)
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  } catch (error) {
    logger.error('Error generating Excel:', error)
    throw new Error('Failed to generate Excel file')
  }
}
