import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import { ExportOptions, resultMapping, SHARED_COLUMNS } from './exportTypes'
import { parseNumber } from '@/app/(frontend)/helpers/utils-data-table'
import { booleanToIcon, formatNormalDate } from './exportUtils'
import { formatNumberWithLocale } from '@/utils/numberUtils'

export async function generateParticipationsExcel(
  data: any[],
  options: ExportOptions,
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('דוח השתתפות באסיפות')

    worksheet.views = [{ rightToLeft: true }]

    const baseHeaders: (typeof SHARED_COLUMNS)[keyof typeof SHARED_COLUMNS][] = [
      SHARED_COLUMNS.STOCK_NUMBER,
      SHARED_COLUMNS.CORPORATE_NAME,
      SHARED_COLUMNS.COMPANY_NAME,
      SHARED_COLUMNS.STOCK_NAME,
      SHARED_COLUMNS.MARKET_VALUE,
      SHARED_COLUMNS.PERCENTAGE_HOLDING,
      SHARED_COLUMNS.HOLDING_VALUE,
      SHARED_COLUMNS.MEETING_DATE,
      SHARED_COLUMNS.MEETING_TYPE,
    ]
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
    const agendaTextIndex = headers.indexOf(SHARED_COLUMNS.SUBJECT) + 1

    try {
      const logoPath = path.join(process.cwd(), 'public', 'emda_logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoImageId = workbook.addImage({
          buffer: logoBuffer,
          extension: 'png',
        })
        worksheet.addImage(logoImageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 100, height: 40 },
        })
      }
    } catch (logoError: any) {
      logger.error('Could not add logo to Excel:', logoError)
    }

    const titleRow = worksheet.addRow(['דו"ח השתתפות באסיפות'])
    titleRow.font = { bold: true, size: 16, name: 'Arial' }
    titleRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(1, 1, 1, headers.length)
    titleRow.getCell(1).style.font = { name: 'Arial', size: 20, bold: true } // החלת סגנון כותרת

    const reportNameRow = worksheet.addRow([options.reportName])
    reportNameRow.font = { bold: true, size: 14, name: 'Arial' }
    reportNameRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(2, 1, 2, headers.length)
    reportNameRow.getCell(1).style.font = { name: 'Arial', size: 16 } // החלת סגנון כותרת משנה

    const dateRangeText = `${formatNormalDate(options.dateRange.startDate)} - ${formatNormalDate(options.dateRange.endDate)}`
    const dateRow = worksheet.addRow([dateRangeText])
    dateRow.font = { bold: true, size: 14, name: 'Arial' }
    dateRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(3, 1, 3, headers.length)
    dateRow.getCell(1).style.font = { name: 'Arial', size: 14 } // החלת סגנון כותרת משנה

    worksheet.mergeCells(4, 1, 4, headers.length)
    worksheet.addRow(['']) 

    const headerRowOffset = 5
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FF000000' }, name: 'Arial' }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'EDEDED' },
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.views = [{ state: 'frozen', ySplit: headerRowOffset + 1, rightToLeft: true }]

    if (data.length === 0) {
      const noDataRow = worksheet.addRow(['אין נתונים להצגה'])
      noDataRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })
      return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    data.forEach((meeting) => {
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
        meeting.corporateName,
        meeting.currentCompany.name,
        meeting.stockName,
        formattedMarketValue,
        formattedPercentageHolding,
        formattedHoldingValueInMillions,
        meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
        meeting.meetingType,
      ]

      if (meeting.agendas.length === 0) {
        const emptyAgendaData = Array(agendaHeaders.length).fill('')
        const excelRow = worksheet.addRow([...meetingData, ...emptyAgendaData])
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD2E4FF' },
        }
        excelRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10 }
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
        })
      } else {
        meeting.agendas.forEach(
          (
            agenda: {
              text: string
              recommendation: { votingRecommendation: any }
              vote: any
              result: string | number
              meetingResults: any
              privilegedMajority: boolean
              simpleMajority: boolean
              percentResult: any
              policyCompliance: any
              conflictOfInterest: any
              relatedParty: any
              personalInterest: any
            },
            index: number,
          ) => {
            const isFirstAgenda = index === 0
            const numberedAgendaText = agenda.text ? `${index + 1}. ${agenda.text}` : ''
            const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
            const alignment = isEnglish ? 'left' : 'right'
            const agendaData = [
              numberedAgendaText,
              agenda.recommendation?.votingRecommendation || '',
              agenda.vote || '',
              agenda.result
                ? resultMapping[agenda.result] || agenda.result
                : agenda.meetingResults || '',
              agenda.simpleMajority && agenda.percentResult
                ? `${formatNumberWithLocale(agenda.percentResult)}%`
                : booleanToIcon(agenda.simpleMajority),
              agenda.privilegedMajority && agenda.percentResult
                ? `${formatNumberWithLocale(agenda.percentResult)}%`
                : booleanToIcon(agenda.privilegedMajority),
              booleanToIcon(agenda.policyCompliance),
              booleanToIcon(agenda.conflictOfInterest),
              booleanToIcon(agenda.relatedParty),
              booleanToIcon(agenda.personalInterest),
            ]
            const excelRow = worksheet.addRow([...meetingData, ...agendaData])
            excelRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isFirstAgenda ? 'FFD2E4FF' : 'F5FAFF' },
            }
            excelRow.eachCell((cell, colNumber) => {
              const isVIcon = cell.value === 'V'
              cell.font = {
                name: 'Arial',
                size: 10,
                ...(isVIcon && { color: { argb: 'FF008000' }, bold: true }),
              }

              cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
              if (colNumber === agendaTextIndex) {
                cell.alignment = {
                  horizontal: alignment,
                  vertical: 'middle',
                  wrapText: true,
                }
              }
            })
          },
        )
      }
    })

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
        newWidth *= 1.5
        column.width = Math.min(newWidth, 70)
      } else {
        newWidth *= 0.75
        column.width = Math.min(newWidth, 50)
      }
    })

    const lastRow = worksheet.rowCount
    const lastCol = headers.length
    const whiteBorder = { style: 'thin' as const, color: { argb: 'FFFFFFFF' } }
    const grayBorder = { style: 'thin' as const, color: { argb: 'EDEDED' } }

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
          cell.font = { name: cell.font?.name || 'Arial', size: 10, color: cell.font?.color }
        }
      }
    }

    const endRowMessage = ' שדה אחרון בשורה זו'
    const endColMessage = ' רשומה האחרונה בעמודה זו'

    for (let row = headerRowOffset + 1; row <= lastRow; row++) {
      const cell = worksheet.getCell(row, lastCol + 1)
      cell.value = endRowMessage
      cell.font = { name: 'ARIAL', size: 10 }
      workbook.definedNames.add(`'${worksheet.name}'!$${cell.address}`, `EndOfRow_${row}`)
    }

    for (let col = 1; col <= lastCol; col++) {
      const cell = worksheet.getCell(lastRow + 1, col)
      cell.value = endColMessage
      cell.font = { name: 'ARIAL', size: 10 }
      workbook.definedNames.add(`'${worksheet.name}'!$${cell.address}`, `EndOfCol_${col}`)
    }

    worksheet.getColumn(lastCol + 1).width = endRowMessage.length + 5

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  } catch (error: any) {
    logger.error('Error generating Excel:', error)
    throw new Error('Failed to generate Excel file')
  }
}
