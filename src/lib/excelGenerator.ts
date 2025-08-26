import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import {
  booleanToText,
  ExportOptions,
  formatNormalDate,
  groupDataByMeeting,
  resultMapping,
  SHARED_COLUMNS,
} from './exportTypes'
import { parseNumber } from '@/app/(frontend)/helpers/utils-data-table'
import { formatNumberWithLocale } from './utils'

export async function generateParticipationsExcel(
  data: any[],
  options: ExportOptions,
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('דוח השתתפות באסיפות')
    worksheet.views = [{ rightToLeft: true }]

    // Group data
    const groupedData = groupDataByMeeting(data)

    // Define column headers in Hebrew (without 'מס״ד')
    const baseHeaders: (typeof SHARED_COLUMNS)[keyof typeof SHARED_COLUMNS][] = [
      SHARED_COLUMNS.STOCK_NUMBER,
      SHARED_COLUMNS.STOCK_NAME,
      SHARED_COLUMNS.MARKET_VALUE,
      SHARED_COLUMNS.PERCENTAGE_HOLDING,
      SHARED_COLUMNS.HOLDING_VALUE,
      SHARED_COLUMNS.MEETING_DATE,
      SHARED_COLUMNS.MEETING_TYPE,
    ]
    if (options.selectedCompaniesCount > 1) {
      baseHeaders.push(SHARED_COLUMNS.COMPANY_NAME)
    }
    const agendaHeaders = [
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
    ]
    const headers = [...baseHeaders, ...agendaHeaders]

    // Find indices for specific columns for later formatting
    const agendaTextIndex = headers.indexOf(SHARED_COLUMNS.SUBJECT) + 1

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
    } catch (logoError: any) {
      logger.error('Could not add logo to Excel:', logoError)
    }

    // Add title rows
    const titleRow = worksheet.addRow(['דו"ח השתתפות באסיפות'])
    titleRow.font = { bold: true, size: 16, name: 'Arial' }
    titleRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(1, 1, 1, headers.length)

    const reportNameRow = worksheet.addRow([options.reportName])
    reportNameRow.font = { bold: true, size: 14, name: 'Arial' }
    reportNameRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(2, 1, 2, headers.length)

    const dateRangeText = `${formatNormalDate(options.dateRange.startDate)} - ${formatNormalDate(options.dateRange.endDate)}`
    const dateRow = worksheet.addRow([dateRangeText])
    dateRow.font = { bold: true, size: 14, name: 'Arial' }
    dateRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(3, 1, 3, headers.length)

    const emptyText = ''
    worksheet.mergeCells(4, 1, 4, headers.length)
    worksheet.addRow([emptyText])

    const headerRowOffset = 5

    // Add headers
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FF000000' }, name: 'Arial' }
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
      const formattedMarketValue = formatNumberWithLocale(
        parseNumber(meeting.marketValue) / 1_000_000,
        0,
      )
      const formattedPercentageHolding = formatNumberWithLocale(meeting.percentageHolding, 4)
      const formattedHoldingValueInMillions = formatNumberWithLocale(
        meeting.holdingValueInMillions,
        2,
      )
      const meetingData = [
        meeting.stockNumber,
        meeting.stockName,
        formattedMarketValue,
        formattedPercentageHolding,
        formattedHoldingValueInMillions,
        meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
        meeting.meetingType,
      ]
      if (options.selectedCompaniesCount > 1) {
        meetingData.push(meeting.companyName || '')
      }

      if (meeting.agendas.length === 0) {
        const emptyAgendaData = Array(agendaHeaders.length).fill('')
        const excelRow = worksheet.addRow([...meetingData, ...emptyAgendaData])
        excelRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10 }
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
        })
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD2E4FF' },
        }
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
            agenda.privilegedMajority && agenda.vPercentSpecial ? `${agenda.vPercentSpecial}` : '',
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
  } catch (error: any) {
    logger.error('Error generating Excel:', error)
    throw new Error('Failed to generate Excel file')
  }
}
