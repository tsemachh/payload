import { meetingStateOptions } from '@/consts/otipns-const'
import ExcelJS from 'exceljs'

export async function downloadMeetingsExcel(
  meetingData: any[],
  columns: string[],
  viewMode: string,
): Promise<Buffer> {
  columns = columns.filter((col) => !['information', 'תגית'].includes(col.toLowerCase()))
  const agendaIndex = columns.indexOf('סדר יום')
  if (agendaIndex > 0) {
    const [agendaCol] = columns.splice(agendaIndex, 1)
    columns.unshift(agendaCol)
  }
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('אסיפות')
  worksheet.views = [{ rightToLeft: true }]

  const headerRow = worksheet.addRow(columns)
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFA' }, // Light gray to match participation report
  }
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
      bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
      left: { style: 'thin', color: { argb: 'FFF9FAFA' } },
      right: { style: 'thin', color: { argb: 'FFF9FAFA' } },
    }
  })
  const meetingStateMap: Record<string, string> = Object.fromEntries(
    meetingStateOptions.map((opt) => [opt.value, opt.label]),
  )
  const columnMapping: Record<string, (meeting: any) => any> = {
    חברות: (m) => {
      if (viewMode === 'companies') {
        return ''
      }
      return m.companies?.map((c: any) => c.companyName || c.name).join(', ') || ''
    },
    'שם נייר': (m) => m.stockName,
    'שם תאגיד': (m) => m.companyName,
    סימול: (m) => m.stockSymbol,
    'מס׳ נייר': (m) => m.stockNumber,
    'סוג נייר': (m) => m.stockType,
    'מועד אסיפה': (m) => (m.meetingDate ? new Date(m.meetingDate).toLocaleString('he-IL') : ''),
    'מועד קובע': (m) =>
      m.holdingsLimit ? new Date(m.holdingsLimit).toLocaleDateString('he-IL') : '',
    'מקור נייר': (m) => m.stockOrigin,
    'החזקה (%)': (m) => m.percentageHolding,
    'מועד מסירת הצבעות': (m) =>
      m.proxyVotingDate ? new Date(m.proxyVotingDate).toLocaleString('he-IL') : '',
    'שווי שוק \n (מיליוני ₪)': (m) => m.marketValue,
    'שווי החזקה  (מיליוני ₪)': (m) => m.holdingValueInMillions,
    'תאגיד פיננסי דורש ועדה': (m) => (m.committeeInitiated ? '✅' : '❌'),
    'מופיעה במערכת האלק׳': (m) => (m.electronicVotingEnabled ? '✅' : '❌'),
    'אימות תוצאות': (m) => (m.resultsConfirmationStatus ? '✅' : '❌'),
    'נייר ערך נסחר': (m) => (m.stockTradable ? '✅' : '❌'),
    מחקר: (m) => m.researchDocuments?.length || '',
    'ערך נקוב  מדווח': (m) => m.nominalValueClientReported,
    'ערך נקוב  בפועל': (m) => m.nominalValue,
    מיקום: (m) => {
      if (!m.location) return ''
      const maxLength = 120
      return m.location.length > maxLength ? m.location.substring(0, maxLength) + '...' : m.location
    },
    הערות: (m) => m.comments,
    מצב: (m) => meetingStateMap[m.meetingState] || m.meetingState,
    אסמכתא: (m) => m.reference,
    'סוג אסיפה': (m) => m.meetingType,
    'הצבעה בפועל': (m) => (m.reported ? '✅' : '❌'),
    'ניירות עוקבים': (m) => (m.fromRelatedStock ? '✅' : ''),
  }

  const formatValue = (header: string, meeting: any) => {
    const mapper = columnMapping[header]
    if (mapper) return mapper(meeting)
    return meeting[header] ?? ''
  }

  meetingData.forEach((meeting) => {
    const rowValues = columns.map((header) => formatValue(header, meeting))
    const mainRow = worksheet.addRow(rowValues)
    mainRow.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true }
    mainRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD2E4FF' }, // Light blue
    }
    mainRow.font = { bold: true }
    mainRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
        bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
        left: { style: 'thin', color: { argb: 'FFF9FAFA' } },
        right: { style: 'thin', color: { argb: 'FFF9FAFA' } },
      }
    })
    mainRow.height = Math.min(mainRow.height || 30, 80)

    if (viewMode === 'agenda') {
      meeting.agendas?.forEach((agenda: any, idx: number) => {
        const agendaRow = Array(columns.length).fill('')
        const agendaIndex = columns.indexOf('סדר יום')
        const agendaText = `\u202B${idx + 1}. ${agenda.text || ''}\u202C`
        if (agendaIndex >= 0) {
          agendaRow[agendaIndex] = agendaText
        } else {
          agendaRow[0] = agendaText
        }

        const row = worksheet.addRow(agendaRow)
        row.alignment = { horizontal: 'right', vertical: 'middle', wrapText: false }
        row.font = { italic: true }
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7F0FF' }, // lighter blue
        }
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            left: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            right: { style: 'thin', color: { argb: 'FFF9FAFA' } },
          }
        })
        row.height = 15
        if (agendaIndex >= 0 && agendaIndex < columns.length - 1) {
          worksheet.mergeCells(row.number, agendaIndex + 1, row.number, columns.length)
        }
      })
    }

    if (viewMode === 'companies') {
      meeting.companies?.forEach((company: any, companyIdx: number) => {
        if (companyIdx > 0) {
          const spacerRow = worksheet.addRow(Array(columns.length).fill(''))
          spacerRow.height = 5
        }

        const parentCompanyRow = Array(columns.length).fill('')
        const companiesIndex = columns.indexOf('חברות')
        const parentCompanyText = `\u202B${company.funds?.[0]?.parentCompany?.name || company.companyName || company.name}\u202C`
        if (companiesIndex >= 0) {
          parentCompanyRow[companiesIndex] = parentCompanyText
        } else {
          parentCompanyRow[0] = parentCompanyText
        }

        const parentRow = worksheet.addRow(parentCompanyRow)
        parentRow.alignment = { horizontal: 'right', vertical: 'middle', wrapText: false }
        parentRow.font = { bold: true }
        parentRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7F0FF' },
        }
        parentRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            left: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            right: { style: 'thin', color: { argb: 'FFF9FAFA' } },
          }
        })
        parentRow.height = 15
        if (companiesIndex >= 0 && companiesIndex < columns.length - 1) {
          worksheet.mergeCells(
            parentRow.number,
            companiesIndex + 1,
            parentRow.number,
            columns.length,
          )
        }

        company.funds?.forEach((fund: any) => {
          const fundRow = Array(columns.length).fill('')
          const fundText = `\u202B ${fund.holdingsCompanyName || ''}\u202C`
          if (companiesIndex >= 0) {
            fundRow[companiesIndex] = fundText
          } else {
            fundRow[0] = fundText
          }

          const row = worksheet.addRow(fundRow)
          row.alignment = { horizontal: 'right', vertical: 'middle', wrapText: false }
          row.font = { italic: true }
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          }
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
              bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
              left: { style: 'thin', color: { argb: 'FFF9FAFA' } },
              right: { style: 'thin', color: { argb: 'FFF9FAFA' } },
            }
          })
          row.height = 15
          if (companiesIndex >= 0 && companiesIndex < columns.length - 1) {
            worksheet.mergeCells(row.number, companiesIndex + 1, row.number, columns.length)
          }
        })
      })
    }
  })

  worksheet.columns.forEach((col: any, index: number) => {
    col.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
    const columnHeader = columns[index]
    if (columnHeader === 'מיקום') {
      col.width = 25
    } else if (columnHeader === 'מועד אסיפה' || columnHeader === 'מועד מסירת הצבעות') {
      col.width = 18
    } else {
      if (columnHeader === 'אסמכתא') {
        col.width = 16
      } else {
        col.width = 10
      }
    }

    const companiesIndex = columns.indexOf('חברות')
    const agendaIndex = columns.indexOf('סדר יום')
    if (viewMode === 'companies' && columnHeader === 'סדר יום') {
      col.hidden = true
    } else if (viewMode === 'agenda' && columnHeader === 'חברות') {
      col.hidden = true
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
