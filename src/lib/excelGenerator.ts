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

    // Column mapping from frontend keys to Excel headers
    const columnMapping: Record<string, string> = {
      stockNumber: SHARED_COLUMNS.STOCK_NUMBER,
      corporateName: SHARED_COLUMNS.CORPORATE_NAME,
      companyName: SHARED_COLUMNS.COMPANY_NAME,
      stockName: SHARED_COLUMNS.STOCK_NAME,
      marketValue: SHARED_COLUMNS.MARKET_VALUE,
      percentageHolding: SHARED_COLUMNS.PERCENTAGE_HOLDING,
      holdingValueInMillions: SHARED_COLUMNS.HOLDING_VALUE,
      meetingDate: SHARED_COLUMNS.MEETING_DATE,
      meetingType: SHARED_COLUMNS.MEETING_TYPE,
      recommendation: SHARED_COLUMNS.ADVISOR_RECOMMENDATION,
      vote: SHARED_COLUMNS.VOTE,
      meetingResults: SHARED_COLUMNS.MEETING_RESULTS,
      simpleMajority: SHARED_COLUMNS.REGULAR_MAJORITY,
      privilegedMajority: SHARED_COLUMNS.SPECIAL_MAJORITY,
      policyCompliance: SHARED_COLUMNS.POLICY_COMPLIANCE,
      conflictOfInterest: SHARED_COLUMNS.CONFLICT_OF_INTEREST,
      relatedParty: SHARED_COLUMNS.RELATED_PARTY,
      personalInterest: SHARED_COLUMNS.PERSONAL_INTEREST,
      subject: SHARED_COLUMNS.SUBJECT,
    }

    // Parse selected columns from options or use defaults
    let selectedColumns: string[] = []
    if (options.selectedColumns && Array.isArray(options.selectedColumns)) {
      selectedColumns = options.selectedColumns
    } else if (typeof options.selectedColumns === 'string') {
      try {
        selectedColumns = JSON.parse(options.selectedColumns)
      } catch {
        selectedColumns = []
      }
    }

    // Default columns if no selection provided
    const defaultColumns = [
      'stockNumber',
      'corporateName',
      'companyName',
      'stockName',
      'marketValue',
      'percentageHolding',
      'holdingValueInMillions',
      'meetingDate',
      'meetingType',
      'subject',
      'vote',
      'meetingResults',
      'simpleMajority',
      'privilegedMajority',
      'policyCompliance',
      'conflictOfInterest',
      'relatedParty',
      'personalInterest',
    ]

    // Use selected columns or defaults
    const columnsToUse = selectedColumns.length > 0 ? selectedColumns : defaultColumns
    
    // Always ensure subject column is included (add if missing)
    if (!columnsToUse.includes('subject')) {
      // Add subject column after meetingType or at a reasonable position
      const meetingTypeIndex = columnsToUse.indexOf('meetingType')
      if (meetingTypeIndex !== -1) {
        columnsToUse.splice(meetingTypeIndex + 1, 0, 'subject')
      } else {
        // If meetingType not found, add subject after the meeting-related columns
        const insertIndex = Math.max(
          columnsToUse.findIndex(col => ['vote', 'meetingResults', 'recommendation'].includes(col)),
          0
        )
        columnsToUse.splice(insertIndex, 0, 'subject')
      }
    }
    
    // Check if advisor column should be shown
    const showAdvisorColumn = data.some((meeting) => meeting.displayVotingRecommendation === true)
    
    // Add recommendation column if needed and not already present
    if (showAdvisorColumn && !columnsToUse.includes('recommendation')) {
      const subjectIndex = columnsToUse.indexOf('subject')
      if (subjectIndex !== -1) {
        columnsToUse.splice(subjectIndex + 1, 0, 'recommendation')
      }
    }

    // Filter out columns that don't have mapping
    const validColumns = columnsToUse.filter(col => columnMapping[col])
    
    // Create headers from valid columns
    const headers = validColumns.map(col => columnMapping[col])

    // Separate meeting columns from agenda columns
    const meetingColumns = validColumns.filter(col => col !== 'subject' && col !== 'recommendation' && col !== 'vote' && col !== 'meetingResults' && col !== 'simpleMajority' && col !== 'privilegedMajority' && col !== 'policyCompliance' && col !== 'conflictOfInterest' && col !== 'relatedParty' && col !== 'personalInterest')
    const agendaColumns = validColumns.filter(col => col === 'subject' || col === 'recommendation' || col === 'vote' || col === 'meetingResults' || col === 'simpleMajority' || col === 'privilegedMajority' || col === 'policyCompliance' || col === 'conflictOfInterest' || col === 'relatedParty' || col === 'personalInterest')
    const includeAgendaColumns = agendaColumns.length > 0

    // Column width mapping by column key (not position)
    const columnWidthMapping: Record<string, number> = {
      stockNumber: 12,
      corporateName: 22,
      companyName: 22,
      stockName: 17,
      marketValue: 12,
      percentageHolding: 12,
      holdingValueInMillions: 14,
      meetingDate: 12,
      meetingType: 12,
      subject: 72, // Wide for agenda text
      recommendation: 12,
      vote: 13,
      meetingResults: 13,
      simpleMajority: 13,
      privilegedMajority: 13,
      policyCompliance: 33,
      conflictOfInterest: 13,
      relatedParty: 13,
      personalInterest: 13,
    }


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
      // Create complete data mapping for all possible columns
      const completeDataMap: Record<string, any> = {
        stockNumber: meeting.stockNumber,
        corporateName: meeting.corporateName,
        companyName: meeting.currentCompany?.name || '',
        stockName: meeting.stockName,
        marketValue: formatNumberWithLocale(parseNumber(meeting.marketValue) / 1_000_000, 0),
        percentageHolding: formatNumberWithLocale(meeting.percentageHolding, 4),
        holdingValueInMillions: formatNumberWithLocale(meeting.holdingValueInMillions, 2),
        meetingDate: meeting.meetingDate ? formatNormalDate(new Date(meeting.meetingDate)) : '',
        meetingType: meeting.meetingType,
      }

      // Create meeting data based on meeting columns only
      const meetingData = meetingColumns.map(colKey => completeDataMap[colKey] || '')

      if (meeting.agendas.length === 0) {
        // Create row data based on selected columns
        const rowData = validColumns.map(colKey => {
          if (colKey === 'subject') return '' // Empty subject for meetings without agendas
          return completeDataMap[colKey] || ''
        })
        
        const excelRow = worksheet.addRow(rowData)
        const fillColor = 'FFD2E4FF'

        // Set styling
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
              isRemoved?: boolean
            },
            index: number,
          ) => {
            const isFirstAgenda = index === 0
            const isRemoved = agenda.isRemoved === true
            const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
            const alignment = isEnglish ? 'left' : 'right'

            // Prepare agenda text
            const baseAgendaText = agenda.text || ''
            const numberedPrefix = isEnglish ? `${index + 1}. ` : `\u200F${index + 1}. `
            const numberedAgendaText = baseAgendaText ? numberedPrefix + baseAgendaText : ''

            // Check if voteReason exists and is not empty
            let voteContent = !isRemoved ? agenda.vote || '' : ''
            if (!isRemoved && agenda.voteReason && agenda.voteReason.trim() !== '') {
              voteContent = `${voteContent} [${voteReasonCounter}]`
              voteReasons.push({ index: voteReasonCounter, reason: agenda.voteReason })
              voteReasonCounter++
            }

            // Create agenda data map
            const agendaDataMap: Record<string, any> = {
              subject: numberedAgendaText,
              recommendation: isRemoved
                ? ''
                : meeting.displayVotingRecommendation
                  ? agenda.recommendation?.votingRecommendation
                  : '',
              vote: voteContent,
              meetingResults: isRemoved
                ? ''
                : agenda.result
                  ? resultMapping[agenda.result] || agenda.result
                  : agenda.meetingResults || '',
              simpleMajority: isRemoved
                ? ''
                : agenda.simpleMajority && agenda.percentResult
                  ? `${formatNumberWithLocale(agenda.percentResult)}%`
                  : booleanToIcon(agenda.simpleMajority),
              privilegedMajority: isRemoved
                ? ''
                : agenda.privilegedMajority && agenda.percentResult
                  ? `${formatNumberWithLocale(agenda.percentResult)}%`
                  : booleanToIcon(agenda.privilegedMajority),
              policyCompliance: isRemoved ? '' : booleanToIcon(agenda.policyCompliance),
              conflictOfInterest: isRemoved ? '' : booleanToIcon(agenda.conflictOfInterest),
              relatedParty: isRemoved ? '' : booleanToIcon(agenda.relatedParty),
              personalInterest: isRemoved ? '' : booleanToIcon(agenda.personalInterest),
            }

            // Filter agenda data based on selected columns
            const agendaData = includeAgendaColumns
              ? agendaColumns.map((col) => agendaDataMap[col] || '')
              : []

            const excelRow = worksheet.addRow([...meetingData, ...agendaData])
            const fillColor = isFirstAgenda ? 'FFD2E4FF' : 'F5FAFF'

            // Allow row height to auto-adjust based on content (remove fixed height)
            // excelRow.height = 20 - removed to allow auto-sizing

            // Set styling
            excelRow.eachCell((cell, colNumber) => {
              if (colNumber <= headers.length) {
                const isVIcon = cell.value === '✓'
                const isXIcon = cell.value === '✗'
                const isAgendaText =
                  agendaColumns.indexOf('subject') !== -1 &&
                  colNumber ===
                    meetingColumns.length + agendaColumns.indexOf('subject') + 1
                let textColor: string | undefined

                if (isRemoved) {
                  textColor = 'FF808080' // Gray color for removed items
                }

                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: fillColor },
                }

                if (isAgendaText && isRemoved) {
                  const removedNotice = isEnglish ? ' (Removed from agenda)' : ' (הוסר מסדר היום)'
                  cell.value = {
                    richText: [
                      {
                        text: numberedAgendaText,
                        font: {
                          name: 'Arial',
                          size: 10,
                          color: { argb: textColor },
                          strike: true,
                        },
                      },
                      {
                        text: removedNotice,
                        font: {
                          name: 'Arial',
                          size: 10,
                          color: { argb: textColor },
                          strike: false,
                        },
                      },
                    ],
                  }
                } else {
                  cell.font = {
                    name: 'Arial',
                    size: 10,
                    ...(textColor && { color: { argb: textColor } }),
                    ...(isVIcon && { bold: true }),
                  }
                }

                cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
                if (isAgendaText) {
                  cell.alignment = {
                    horizontal: alignment,
                    vertical: 'top', // Changed to top alignment for better readability
                    wrapText: true, // Enable text wrapping for subject column
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

        // Add vote reasons if any
        if (voteReasons.length > 0) {
          const titleText = voteReasons.length === 1 ? 'נימוק הצבעה' : 'נימוקי הצבעה'
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
              cell.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })

          rowFormats.push({
            rowIndex: titleRow.number,
            fillColor: 'FFFFFFFF',
            cellStyles: [{ col: 1, font: { name: 'Arial', size: 11, bold: true } }],
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
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            })

            rowFormats.push({
              rowIndex: reasonRow.number,
              fillColor: 'FFFFFFFF',
              cellStyles: [{ col: 1, font: { name: 'Arial', size: 10 } }],
            })
          })

          voteReasons.length = 0 // Reset for next meeting
        }
      }
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



    // Apply column widths based on actual columns present
    worksheet.columns.forEach((column, i) => {
      const columnKey = validColumns[i]
      if (columnKey && columnWidthMapping[columnKey]) {
        column.width = columnWidthMapping[columnKey]
      } else {
        // Default width for unknown columns
        column.width = 15
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
