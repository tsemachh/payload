import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
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

export async function generateParticipationsExcel(
  data: any[],
  options: ExcelExportOptions,
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('דוח השתתפות באסיפות')
    worksheet.views = [{ rightToLeft: true }]

    // Group data
    const groupedData = groupDataByMeeting(data)

    // Define column headers in Hebrew (without 'מס״ד')
    const baseHeaders = [
      'מספר נייר',
      'שם נייר',
      'שווי שוק (מ׳ ₪)',
      'אחזקה (%)',
      'שווי אחזקה (מ׳ ₪)',
      'מועד האסיפה',
      'סוג האסיפה',
    ]
    if (options.selectedCompaniesCount > 1) {
      baseHeaders.push('שם החברה')
    }
    const agendaHeaders = [
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
    const headers = [...baseHeaders, ...agendaHeaders]

    // Find indices for specific columns for later formatting
    const meetingDateIndex = headers.indexOf('מועד האסיפה') + 1
    const agendaTextIndex = headers.indexOf('נושא') + 1

    // Add Logo
    try {
      const logoPath = path.join(process.cwd(), 'public', 'emda_logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoImageId = workbook.addImage({
          buffer: logoBuffer,
          extension: 'png',
        })
        worksheet.addImage(logoImageId, {
          tl: { col: headers.length - 1, row: 0 },
          ext: { width: 100, height: 40 },
        })
      }
    } catch (logoError) {
      logger.error('Could not add logo to Excel:', logoError)
    }

    // Add title rows
    const titleRow = worksheet.addRow(['דו"ח השתתפות באסיפות'])
    titleRow.font = { bold: true, size: 16 }
    titleRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(1, 1, 1, headers.length)

    const reportNameRow = worksheet.addRow([options.reportName])
    reportNameRow.font = { bold: true, size: 14 }
    reportNameRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(2, 1, 2, headers.length)

    const dateRangeText = `${formatNormalDate(options.dateRange.startDate)} - ${formatNormalDate(options.dateRange.endDate)}`
    const dateRow = worksheet.addRow([dateRangeText])
    dateRow.font = { bold: true, size: 14 }
    dateRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(3, 1, 3, headers.length)

    const emptyText = ''
    worksheet.mergeCells(4, 1, 4, headers.length)
    worksheet.addRow([emptyText])

    const headerRowOffset = 5

    // Add headers
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FF000000' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFA' }, // Light gray
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

    if (groupedData.length === 0) {
      worksheet.addRow(['אין נתונים להצגה'])
      return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    // Add data rows
    groupedData.forEach((meeting) => {
      const booleanToText = (value: any): string => {
        if (value === true) return 'כן'
        if (value === false) return 'לא'
        return ''
      }

      const meetingData = [
        meeting.stockNumber,
        meeting.stockName,
        meeting.marketValue,
        meeting.percentageHolding,
        meeting.holdingValueInMillions,
        meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
        meeting.meetingType,
      ]
      if (options.selectedCompaniesCount > 1) {
        meetingData.push(meeting.companyName || '')
      }

      if (meeting.agendas.length === 0) {
        const emptyAgendaData = Array(agendaHeaders.length).fill('')
        const excelRow = worksheet.addRow([...meetingData, ...emptyAgendaData])
        excelRow.alignment = { horizontal: 'right', vertical: 'middle' }
        excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD2E4FF' } }
      } else {
        meeting.agendas.forEach((agenda, index) => {
          const isFirstAgenda = index === 0
          const agendaData = [
            agenda.text || '',
            agenda.recommendation?.votingRecommendation || '',
            agenda.vote || '',
            agenda.result
              ? resultMapping[agenda.result] || agenda.result
              : agenda.meetingResults || '',
            booleanToText(!agenda.privilegedMajority),
            agenda.privilegedMajority && agenda.vPercentSpecial ? `${agenda.vPercentSpecial}%` : '',
            booleanToText(agenda.policyCompliance),
            booleanToText(agenda.conflictOfInterest),
            booleanToText(agenda.relatedParty),
            booleanToText(agenda.personalInterest),
          ]
          const excelRow = worksheet.addRow([...meetingData, ...agendaData])

          excelRow.alignment = { horizontal: 'right', vertical: 'middle' }
          excelRow.getCell(agendaTextIndex).alignment = {
            horizontal: 'right',
            vertical: 'middle',
            wrapText: true,
          }

          excelRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isFirstAgenda ? 'FFD2E4FF' : 'FFE7F0FF' },
          }
        })
      }
    })

    // Auto-fit columns
    worksheet.columns.forEach((column, i) => {
      let maxLength = 0
      if (typeof column.eachCell === 'function') {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value
            ? cell.value
                .toString()
                .split('\n')
                .reduce((max, line) => Math.max(max, line.length), 0)
            : 0
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
      }
      let newWidth = Math.max(maxLength + 2, 10)

      if (i + 1 === agendaTextIndex) {
        newWidth *= 1.2
        column.width = Math.min(newWidth, 70)
      } else {
        // FIX 2: Reduce the width of other columns by 25%.
        newWidth *= 0.75
        column.width = Math.min(newWidth, 50)
      }
    })

    // Add borders to all data cells
    const lastRow = worksheet.rowCount
    const lastCol = headers.length
    const whiteBorder = { style: 'thin' as const, color: { argb: 'FFFFFFFF' } }
    const grayBorder = { style: 'thin' as const, color: { argb: 'FFD3D3D3' } } // Light gray for header

    for (let row = headerRowOffset; row <= lastRow; row++) {
      for (let col = 1; col <= lastCol; col++) {
        const cell = worksheet.getCell(row, col)
        if (row === headerRowOffset) {
          cell.border = { top: grayBorder, left: grayBorder, bottom: grayBorder, right: grayBorder }
        } else {
          cell.border = {
            top: whiteBorder,
            left: whiteBorder,
            bottom: whiteBorder,
            right: whiteBorder,
          }
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
