import ExcelJS from 'exceljs'

export async function downloadMeetingsExcel(
  meetingData: any[],
  columns: string[],
  viewMode: string,
): Promise<Buffer> {
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
      bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
    }
  })

  const columnMapping: Record<string, (meeting: any) => any> = {
    חברות: (m) => {
      if (viewMode === 'companies') {
        return (
          m.companies
            ?.map((c: any) => c.funds?.[0]?.parentCompany?.name || c.companyName || c.name)
            .join(', ') || ''
        )
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
    'שווי שוק (מיליוני ₪)': (m) =>
      m.marketValue
        ? (m.marketValue / 1_000_000).toLocaleString('he-IL', { maximumFractionDigits: 0 })
        : '',
    'תאגיד פיננסי דורש ועדה': (m) => (m.committeeInitiated ? '✅' : '❌'),
    'מופיעה במערכת האלק׳': (m) => (m.electronicVotingEnabled ? '✅' : '❌'),
    'אימות תוצאות': (m) => (m.resultsConfirmationStatus ? '✅' : '❌'),
    'נייר ערך נסחר': (m) => (m.stockTradable ? '✅' : '❌'),
    מחקר: (m) => m.researchDocuments?.length || 0,
    'ערך נקוב ליום קובע': (m) => m.nominalValue,
    'סדר היום': () => '',
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
      fgColor: { argb: 'FFD2E4FF' }, // Light blue to match participation report
    }
    mainRow.font = { bold: true }
    mainRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF9FAFA' } },
        bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
      }
    })

    // הצגת agenda רק במצב agenda
    if (viewMode === 'agenda') {
      meeting.agendas?.forEach((agenda: any, idx: number) => {
        const agendaRow = Array(columns.length).fill('')
        const agendaIndex = columns.indexOf('סדר היום')

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
          fgColor: { argb: 'FFE7F0FF' }, // Lighter blue to match participation report
        }
        row.eachCell((cell) => {
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
          }
        })

        // הגדרת גובה שורה קבוע
        row.height = 15

        // מיזוג תאים עבור שורות agenda - מהעמודה הנוכחית עד סוף השורה
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

        company.funds?.forEach((fund: any) => {
          const fundRow = Array(columns.length).fill('')
          const companiesIndex = columns.indexOf('חברות')

          const fundText = `\u202B${fund.holdingsCompanyName || ''}\u202C`

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
            fgColor: { argb: 'FFE7F0FF' }, // Lighter blue to match participation report
          }
          row.eachCell((cell) => {
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFF9FAFA' } },
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
    col.width = 10

    const columnHeader = columns[index]

    if (viewMode === 'companies' && columnHeader === 'סדר היום') {
      col.hidden = true
    } else if (viewMode === 'agenda' && columnHeader === 'חברות') {
      col.hidden = true
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
