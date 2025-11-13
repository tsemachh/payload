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

    // Conditionally define agenda headers based on displayVotingRecommendation
    const showAdvisorColumn = data.some((meeting) => meeting.displayVotingRecommendation === true)
    const agendaHeaders = [
      SHARED_COLUMNS.SUBJECT,
      ...(showAdvisorColumn ? [SHARED_COLUMNS.ADVISOR_RECOMMENDATION] : []),
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

    // First, create the title rows directly (not using addRow)
    // Row 1: Title
    worksheet.getCell(1, 1).value = 'דו"ח השתתפות באסיפות'
    worksheet.mergeCells(1, 1, 1, headers.length)
    worksheet.getRow(1).font = { name: 'Arial', size: 20, bold: true }
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' }

    // Row 2: Report name
    worksheet.getCell(2, 1).value = options.reportName
    worksheet.mergeCells(2, 1, 2, headers.length)
    worksheet.getRow(2).font = { name: 'Arial', size: 16, bold: true }
    worksheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' }

    // Row 3: Date range
    const dateRangeText = `${formatNormalDate(options.dateRange.startDate)} - ${formatNormalDate(options.dateRange.endDate)}`
    worksheet.getCell(3, 1).value = dateRangeText
    worksheet.mergeCells(3, 1, 3, headers.length)
    worksheet.getRow(3).font = { name: 'Arial', size: 14, bold: true }
    worksheet.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' }

    // Row 4: Empty row
    worksheet.addRow([])
    // Now add the logo - it will overlay on top but won't push the text
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

    // Define header row offset
    const headerRowOffset = 4

    worksheet.views = [{ state: 'frozen', ySplit: headerRowOffset, rightToLeft: true }]

    if (data.length === 0) {
      const noDataRow = worksheet.addRow(['אין נתונים להצגה'])
      noDataRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })
      return Buffer.from(await workbook.xlsx.writeBuffer())
    }

    // Store row indices and their formatting for reapplication
    const rowFormats: {
      rowIndex: number
      fillColor: string
      cellStyles: { col: number; font: any }[]
    }[] = []

    // Initialize vote reason counter and storage
    const voteReasons: { index: number; reason: string }[] = []
    let voteReasonCounter = 1

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
        const fillColor = 'FFD2E4FF'
        excelRow.eachCell((cell, colNumber) => {
          if (colNumber <= headers.length) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: fillColor },
            }
            cell.font = { name: 'Arial', size: 10 }
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
          }
        })
        const cellStyles: { col: number; font: any }[] = []
        excelRow.eachCell((cell, colNumber) => {
          if (colNumber <= headers.length) {
            cellStyles.push({ col: colNumber, font: cell.font })
          }
        })
        rowFormats.push({ rowIndex: excelRow.number, fillColor, cellStyles })
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
              voteReason?: string
            },
            index: number,
          ) => {
            const isFirstAgenda = index === 0
            const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
            const alignment = isEnglish ? 'left' : 'right'
            const numberedAgendaText = agenda.text
              ? isEnglish
                ? `${index + 1}. ${agenda.text}`
                : `\u200F${index + 1}. ${agenda.text}`
              : ''
            // Check if voteReason exists and is not empty
            let voteContent = agenda.vote || ''
            if (agenda.voteReason && agenda.voteReason.trim() !== '') {
              voteContent = `${voteContent} [${voteReasonCounter}]`
              voteReasons.push({ index: voteReasonCounter, reason: agenda.voteReason })
              voteReasonCounter++
            }
            const agendaData = [
              numberedAgendaText,
              ...(showAdvisorColumn
                ? [
                    meeting.displayVotingRecommendation
                      ? agenda.recommendation?.votingRecommendation
                      : '',
                  ]
                : []),
              voteContent,
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
            const fillColor = isFirstAgenda ? 'FFD2E4FF' : 'F5FAFF'
            excelRow.eachCell((cell, colNumber) => {
              if (colNumber <= headers.length) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: fillColor },
                }
                const isVIcon = cell.value === '\u2713'
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
              }
            })
            const cellStyles: { col: number; font: any }[] = []
            excelRow.eachCell((cell, colNumber) => {
              if (colNumber <= headers.length) {
                cellStyles.push({ col: colNumber, font: cell.font })
              }
            })
            rowFormats.push({ rowIndex: excelRow.number, fillColor, cellStyles })
          },
        )
        // Add vote reasons as merged rows with white background
        if (voteReasons.length > 0) {
          // Add title row
          const titleText = voteReasons.length === 1 ? 'הערת הצבעה' : 'הערות הצבעה'
          const titleRow = worksheet.addRow([titleText, ...Array(headers.length - 1).fill('')])
          worksheet.mergeCells(titleRow.number, 1, titleRow.number, headers.length)
          titleRow.eachCell((cell, colNumber) => {
            if (colNumber <= headers.length) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' },
              }
              cell.font = { name: 'Arial', size: 11, bold: true }
              cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
            }
          })
          const titleCellStyles: { col: number; font: any }[] = []
          titleRow.eachCell((cell, colNumber) => {
            if (colNumber <= headers.length) {
              titleCellStyles.push({ col: colNumber, font: cell.font })
            }
          })
          rowFormats.push({
            rowIndex: titleRow.number,
            fillColor: 'FFFFFFFF',
            cellStyles: titleCellStyles,
          })

          voteReasons.forEach(({ index, reason }) => {
            const isEnglishReason = /^[A-Za-z]/.test(reason?.trim?.() || '')
            const reasonText = isEnglishReason ? `${reason} .${index}` : `${index}. ${reason}`
            const reasonRow = worksheet.addRow([reasonText, ...Array(headers.length - 1).fill('')])
            worksheet.mergeCells(reasonRow.number, 1, reasonRow.number, headers.length)
            reasonRow.eachCell((cell, colNumber) => {
              if (colNumber <= headers.length) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFFFF' },
                }
                cell.font = { name: 'Arial', size: 10 }
                cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
              }
            })
            const cellStyles: { col: number; font: any }[] = []
            reasonRow.eachCell((cell, colNumber) => {
              if (colNumber <= headers.length) {
                cellStyles.push({ col: colNumber, font: cell.font })
              }
            })
            rowFormats.push({ rowIndex: reasonRow.number, fillColor: 'FFFFFFFF', cellStyles })
          })
          voteReasons.length = 0 // Reset vote reasons for the next meeting
        }
      }
      // Add empty row as separator between meetings
      const emptyRow = worksheet.addRow(Array(headers.length).fill(''))
      worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, headers.length)
      rowFormats.push({ rowIndex: emptyRow.number, fillColor: 'FFFFFFFF', cellStyles: [] })
    })

    // Add Excel table with explicit header configuration
    const tableStartRow = headerRowOffset
    const tableEndRow = worksheet.rowCount
    worksheet.addTable({
      name: 'ParticipationTable',
      ref: `A${tableStartRow}`,
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium2',
        showFirstColumn: false,
        showLastColumn: false,
        showRowStripes: false,
        showColumnStripes: false,
      },
      columns: headers.map((header) => ({
        name: header,
        filterButton: true,
        totalsRowFunction: 'none',
      })),
      rows:
        worksheet.getRows(tableStartRow + 1, tableEndRow - tableStartRow)?.map((row) => {
          const values = Array.isArray(row.values) ? row.values.slice(1, headers.length + 1) : []
          return values
        }) || [],
    })

    // Reapply data row formatting to preserve background colors and font colors
    rowFormats.forEach(({ rowIndex, fillColor, cellStyles }) => {
      const row = worksheet.getRow(rowIndex)
      row.eachCell((cell, colNumber) => {
        if (colNumber <= headers.length) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor },
          }
          const cellStyle = cellStyles.find((style) => style.col === colNumber)
          if (cellStyle) {
            cell.font = cellStyle.font
          }
        }
      })
    })

    // Apply header styling to table header row - MUST BE AFTER reapplying data row formatting
    const headerRow = worksheet.getRow(headerRowOffset)
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber <= headers.length) {
        cell.font = { bold: true, size: 10, color: { argb: 'FF000000' }, name: 'Arial' }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'EDEDED' },
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })

    // Define fixed column widths with comments indicating corresponding columns
    const columnWidths = showAdvisorColumn
      ? [
          12, // Column 1: מספר נייר ערך (Stock Number)
          22, // Column 2: שם תאגיד (Corporate Name)
          22, // Column 3: שם החברה (Company Name)
          17, // Column 4: שם נייר ערך (Stock Name)
          12, // Column 5: שווי שוק (Market Value)
          12, // Column 6: אחוז החזקה (Percentage Holding)
          14, // Column 7: שווי החזקה (Holding Value)
          12, // Column 8: תאריך אסיפה (Meeting Date)
          12, // Column 9: סוג אסיפה (Meeting Type)
          72, // Column 10: נושא (Subject)
          12, // Column 11: המלצת יועץ (Advisor Recommendation)
          12, // Column 12: הצבעה (Vote)
          12, // Column 13: תוצאות האסיפה (Meeting Results)
          12, // Column 14: רוב רגיל (Regular Majority)
          12, // Column 15: רוב מיוחד (%) (Special Majority)
          33, // Column 16: בהתאם למדיניות (Policy Compliance)
          12, // Column 17: ניגוד עניינים (Conflict of Interest)
          12, // Column 18: קשר (Related Party)
          12, // Column 19: אישי (Personal Interest)
        ]
      : [
          12, // Column 1: מספר נייר ערך (Stock Number)
          22, // Column 2: שם תאגיד (Corporate Name)
          22, // Column 3: שם החברה (Company Name)
          17, // Column 4: שם נייר ערך (Stock Name)
          12, // Column 5: שווי שוק (Market Value)
          12, // Column 6: אחוז החזקה (Percentage Holding)
          14, // Column 7: שווי החזקה (Holding Value)
          12, // Column 8: תאריך אסיפה (Meeting Date)
          12, // Column 9: סוג אסיפה (Meeting Type)
          72, // Column 10: נושא (Subject)
          13, // Column 11: הצבעה (Vote) +1
          13, // Column 12: תוצאות האסיפה (Meeting Results) +1
          13, // Column 13: רוב רגיל (Regular Majority) +1
          13, // Column 14: רוב מיוחד (%) (Special Majority) +1
          33, // Column 15: בהתאם למדיניות (Policy Compliance) +2
          13, // Column 16: ניגוד עניינים (Conflict of Interest) +1
          13, // Column 17: קשר (Related Party) +1
          13, // Column 18: אישי (Personal Interest) +1
        ]

    // Apply fixed column widths
    worksheet.columns.forEach((column, i) => {
      if (i < columnWidths.length) {
        column.width = columnWidths[i]
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
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      workbook.definedNames.add(`'${worksheet.name}'!$${cell.address}`, `EndOfRow_${row}`)
    }

    for (let col = 1; col <= lastCol; col++) {
      const cell = worksheet.getCell(lastRow + 1, col)
      cell.value = endColMessage
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      workbook.definedNames.add(`'${worksheet.name}'!$${cell.address}`, `EndOfCol_${col}`)
    }

    worksheet.getColumn(lastCol + 1).width = endRowMessage.length + headerRowOffset

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  } catch (error: any) {
    logger.error('Error generating Excel:', error)
    throw new Error('Failed to generate Excel file')
  }
}
