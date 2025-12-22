import type { PayloadRequest } from 'payload'
import ExcelJS from 'exceljs'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function ExportMeetingsExcelEndpoint(req: PayloadRequest) {
  const startTime = Date.now()
  
  try {
    console.log('Starting Excel export...')
    const payload = await getPayload({ config })
    
    // Get query parameters from the request
    const { where, sort, limit } = req.query || {}
    
    // Parse where clause if it exists
    let whereClause = {}
    if (where && typeof where === 'string') {
      try {
        whereClause = JSON.parse(where)
      } catch (e) {
        console.warn('Failed to parse where clause:', e)
      }
    }
    
    console.log('Fetching meetings data...')
    const fetchStart = Date.now()
    
    // Fetch meetings data with minimal depth for better performance
    const meetingsResult = await payload.find({
      collection: 'meetings',
      where: whereClause,
      sort: (sort as string) || '-meetingDate',
      limit: limit ? parseInt(limit as string) : 1000,
      depth: 0, // Minimal depth for performance
      select: {
        id: true,
        stock: true,
        stockValue: true,
        stockMarketValue: true,
        meetingDate: true,
        holdingsLimit: true,
        agenda: true,
      }
    })

    console.log(`Fetched ${meetingsResult.docs.length} meetings in ${Date.now() - fetchStart}ms`)

    // Get unique stock IDs for batch fetching
    const stockIds = [...new Set(meetingsResult.docs.map((meeting: any) => meeting.stock).filter(Boolean))]
    
    console.log(`Fetching ${stockIds.length} stocks...`)
    const stocksFetchStart = Date.now()
    
    // Batch fetch stocks data
    const stocksMap = new Map()
    if (stockIds.length > 0) {
      const stocksResult = await payload.find({
        collection: 'stocks',
        where: { id: { in: stockIds } },
        limit: stockIds.length,
        depth: 0,
        select: {
          id: true,
          stockId: true,
          fullName: true,
          type: true,
        }
      })
      stocksResult.docs.forEach((stock: any) => {
        stocksMap.set(stock.id, stock)
      })
    }

    console.log(`Fetched stocks in ${Date.now() - stocksFetchStart}ms`)

    // Get unique stock value IDs for batch fetching
    const stockValueIds = [...new Set(meetingsResult.docs.map((meeting: any) => meeting.stockValue).filter(Boolean))]
    
    console.log(`Fetching ${stockValueIds.length} stock values...`)
    const stockValuesFetchStart = Date.now()
    
    // Batch fetch stock values data
    const stockValuesMap = new Map()
    if (stockValueIds.length > 0) {
      const stockValuesResult = await payload.find({
        collection: 'stock-values',
        where: { id: { in: stockValueIds } },
        limit: stockValueIds.length,
        depth: 0,
        select: {
          id: true,
          marketValue: true,
        }
      })
      stockValuesResult.docs.forEach((stockValue: any) => {
        stockValuesMap.set(stockValue.id, stockValue)
      })
    }

    console.log(`Fetched stock values in ${Date.now() - stockValuesFetchStart}ms`)
    console.log('Creating Excel workbook...')
    const excelStart = Date.now()

    // Create a new workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('אסיפות')

    // Set RTL direction for Hebrew and freeze panes
    worksheet.views = [{ 
      rightToLeft: true,
      state: 'frozen',
      xSplit: 0,
      ySplit: 3, // Freeze rows 1-3 (title, header, separator)
      topLeftCell: 'A4',
      activeCell: 'A4'
    }]

    // Extract years from the filtered data for the header
    const years = new Set<number>()
    meetingsResult.docs.forEach((meeting: any) => {
      if (meeting.meetingDate) {
        const year = new Date(meeting.meetingDate).getFullYear()
        years.add(year)
      }
    })
    
    // If no years found, use current year
    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }
    
    const sortedYears = Array.from(years).sort()
    const yearRange = sortedYears.length === 1 ? 
      sortedYears[0].toString() : 
      `${Math.min(...sortedYears)}-${Math.max(...sortedYears)}`

    // Add title row (single row, no background) - merge across all columns
    worksheet.mergeCells('A1:I1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `דוח המלצות - עמדה מחקר כלכלי בע"מ - ${yearRange}`
    titleCell.font = { bold: true, size: 16, color: { argb: '000000' }, name: 'Arial' } // Black, bold, Arial
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    
    // Set title row height
    worksheet.getRow(1).height = 25

    // Define columns with Hebrew headers (starting from row 2 - no gap)
    const columns = [
      { header: 'מספר נייר', key: 'stockId', width: 15 },
      { header: 'שם חברה', key: 'companyName', width: 35 },
      { header: 'סוג נייר', key: 'stockType', width: 20 },
      { header: 'שווי שוק', key: 'marketValue', width: 18 },
      { header: 'תאריך אסיפה', key: 'meetingDate', width: 18 },
      { header: 'מועד קובע', key: 'holdingsLimit', width: 18 },
      { header: 'נושאים', key: 'subjects', width: 50}, // 370px ≈ 50 Excel units
      { header: 'המלצה', key: 'recommendation', width: 10 },
      { header: 'נימוק', key: 'reasoning', width: 45 }, // Increased for better text display
    ]

    // Add headers to row 2
    const headerRow = worksheet.getRow(2)
    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = col.header
      worksheet.getColumn(index + 1).width = col.width
    })

    // Style the header row only
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12, name: 'Arial' }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '44546A' }
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 30

    // Add data rows (starting from row 4 - after the separator)
    let currentRow = 4
    
    // Add thin gray separator row between header and data (row 3)
    const separatorRow = worksheet.getRow(3)
    separatorRow.height = 3 // Very thin row
    
    // Fill all columns with gray
    for (let col = 1; col <= columns.length; col++) {
      const cell = separatorRow.getCell(col)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E0E0E0' } // Light gray
      }
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      }
    }
    
    // פונקציה מדויקת לחישוב גובה שורה על פי תוכן התאים
    function calculateRowHeight(row: ExcelJS.Row, columnWidths: number[]): number {
      let maxHeight = 18 // גובה מינימלי צפוף יותר
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const columnWidth = columnWidths[colNumber - 1] || 10
        const text = cell.text || cell.value?.toString() || ''
        
        if (!text || text.trim() === '') return
        
        // הגדרות הפונט והאליינמנט מהתא
        const font = cell.font || { size: 11, name: 'Arial' }
        const isWrapText = cell.alignment?.wrapText === true
        
        if (!isWrapText) {
          // אם אין wrap - גובה בסיסי צפוף
          maxHeight = Math.max(maxHeight, 18)
          return
        }
        
        // התמקדות בעמודות הטקסט הארוכות (נושאים ונימוק)
        const isTextColumn = colNumber === 7 || colNumber === 9 // עמודות נושאים ונימוק
        
        // חישוב מדויק יותר מבוסס על רוחב עמודה, גודל פונט וטקסט
        const fontSize = font.size || 11
        const lineHeight = fontSize * 1.15 // צפוף יותר - קרוב לגובה הפונט בפועל
        const padding = isTextColumn ? 4 : 3 // padding מינימלי
        
        // זיהוי סוג הטקסט לחישוב מדויק יותר של רוחב התווים
        const hasHebrew = /[\u0590-\u05FF]/.test(text)
        const hasEnglish = /[a-zA-Z]/.test(text)
        const hasNumbers = /[0-9]/.test(text)
        const hasPunctuation = /[.,;:!?()[\]{}״"׳'"-]/.test(text)
        
        // חישוב רוחב תו ממוצע מדויק יותר
        let avgCharWidth = fontSize * 0.6 // ברירת מחדל
        if (hasHebrew && hasEnglish) {
          avgCharWidth = fontSize * 0.7 // טקסט מעורב צריך יותר מקום
        } else if (hasHebrew && !hasEnglish) {
          avgCharWidth = fontSize * 0.75 // עברית רחבה יותר
        } else if (hasEnglish && !hasHebrew) {
          avgCharWidth = fontSize * 0.58 // אנגלית צרה יותר
        }
        
        if (hasNumbers) {
          avgCharWidth *= 1.05 // מספרים צריכים מעט יותר מקום
        }
        
        if (hasPunctuation) {
          avgCharWidth *= 1.02 // סימני פיסוק תופסים מקום
        }
        
        // המרה מדויקת יותר מיחידות Excel לפיקסלים
        // Excel unit ≈ 7.5 pixels for Arial 11pt
        const pixelsPerUnit = isTextColumn ? 7.5 : 7
        const availableWidthPixels = columnWidth * pixelsPerUnit
        const cellPadding = isTextColumn ? 8 : 6 // פחות padding
        const effectiveWidth = availableWidthPixels - cellPadding
        
        // חישוב מספר שורות
        let lines = 1
        
        // טיפול בשורות ידניות
        if (text.includes('\n')) {
          const paragraphs = text.split('\n')
          lines = 0
          
          paragraphs.forEach(paragraph => {
            if (paragraph.trim() === '') {
              lines += 1 // שורה ריקה
              return
            }
            
            // חישוב wrapping לכל פסקה
            const paragraphLines = calculateTextWrapping(paragraph, effectiveWidth, avgCharWidth)
            lines += paragraphLines
          })
        } else {
          // חישוב wrapping רגיל
          lines = calculateTextWrapping(text, effectiveWidth, avgCharWidth)
        }
        
        // הוספת מרווח נוסף לעמודות טקסט ארוכות - הוסר כדי להיות צפוף יותר
        // if (isTextColumn && lines > 1) {
        //   lines += 0.2 // מרווח קטן נוסף
        // }
        
        const calculatedHeight = (lines * lineHeight) + padding
        maxHeight = Math.max(maxHeight, calculatedHeight)
      })
      
      // מגבלה עליונה סבירה
      return Math.min(Math.max(maxHeight, 18), 300) // גובה מינימלי נמוך יותר
    }
    
    // פונקציה עזר לחישוב wrapping של טקסט
    function calculateTextWrapping(text: string, availableWidth: number, avgCharWidth: number): number {
      if (!text || text.trim() === '') return 1
      
      // פיצול למילים תוך התחשבות בסימני פיסוק ורווחים
      const parts = text.split(/(\s+|[.,;:!?()[\]{}״"׳'"\-–—])/).filter(part => part.length > 0)
      
      let currentLineWidth = 0
      let lines = 1
      const spaceWidth = avgCharWidth * 0.3 // רוחב רווח
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        
        if (/^\s+$/.test(part) && currentLineWidth === 0) {
          continue
        }
        
        const partWidth = part.length * avgCharWidth
        
        if (currentLineWidth === 0) {
          currentLineWidth = partWidth
          
          if (partWidth > availableWidth) {
            const extraLines = Math.ceil(partWidth / availableWidth) - 1
            lines += extraLines
            currentLineWidth = partWidth % availableWidth
          }
        } else if (currentLineWidth + partWidth <= availableWidth) {
          currentLineWidth += partWidth
        } else {
          lines++
          currentLineWidth = partWidth
          
          if (partWidth > availableWidth) {
            const extraLines = Math.ceil(partWidth / availableWidth) - 1
            lines += extraLines
            currentLineWidth = partWidth % availableWidth
          }
        }
      }
      
      return Math.max(lines, 1)
    }
    
    meetingsResult.docs.forEach((meeting: any) => {
      // Get stock and stock value from maps for better performance
      const stock = stocksMap.get(meeting.stock)
      const stockValue = stockValuesMap.get(meeting.stockValue)
      
      // Format market value in millions without decimals
      const formatMarketValue = (value: number) => {
        if (!value) return ''
        const millions = Math.round(value / 1000000) // Convert to millions and round
        return new Intl.NumberFormat('he-IL').format(millions)
      }
      
      // Format dates with slashes instead of dots
      const formatDate = (dateString: string) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      }

      // Function to detect and format mixed Hebrew/English text
      const formatMixedText = (text: string) => {
        if (!text) return ''
        
        // Check if text contains both Hebrew and English
        const hasHebrew = /[\u0590-\u05FF]/.test(text)
        const hasEnglish = /[a-zA-Z]/.test(text)
        
        if (hasHebrew && hasEnglish) {
          // Mixed text - ensure proper RTL/LTR formatting
          // Split by sentences and handle each part
          return text
            .replace(/([a-zA-Z][a-zA-Z0-9\s\.,;:!?\-()]*)/g, '\u202A$1\u202C') // LTR for English parts
            .replace(/^/, '\u202B') // RTL at start
            .replace(/$/, '\u202C') // End RTL
        } else if (hasEnglish && !hasHebrew) {
          // Pure English - add LTR mark
          return '\u202A' + text + '\u202C'
        }
        
        return text
      }

      // Get all agenda items with recommendations
      const agendaItems = meeting.agenda || []
      const itemsWithRecommendations = agendaItems.filter((item: any) => 
        item.recommendation?.votingRecommendation && 
        item.recommendation.votingRecommendation !== '----'
      )

      if (itemsWithRecommendations.length > 0) {
        // Create a row for each agenda item with recommendation
        itemsWithRecommendations.forEach((item: any) => {
          const rowData = {
            stockId: stock?.stockId || '',
            companyName: stock?.fullName || '',
            stockType: stock?.type || '',
            marketValue: formatMarketValue(stockValue?.marketValue || meeting.stockMarketValue),
            meetingDate: formatDate(meeting.meetingDate),
            holdingsLimit: formatDate(meeting.holdingsLimit),
            subjects: formatMixedText(item.text || ''),
            recommendation: item.recommendation?.votingRecommendation || '',
            reasoning: formatMixedText(item.recommendation?.reasonText || item.recommendation?.reasonRef || ''),
          }
          
          const row = worksheet.getRow(currentRow)
          
          // Set values for each column
          columns.forEach((col, index) => {
            const cell = row.getCell(index + 1)
            const value = rowData[col.key as keyof typeof rowData]
            cell.value = value
            
            // Special alignment for mixed Hebrew/English text
            if ((col.key === 'subjects' || col.key === 'reasoning') && value && typeof value === 'string') {
              const hasHebrew = /[\u0590-\u05FF]/.test(value)
              const hasEnglish = /[a-zA-Z]/.test(value)
              
              if (hasHebrew && hasEnglish) {
                // Mixed text - use RTL with proper text direction
                cell.alignment = { 
                  horizontal: 'right', 
                  vertical: 'top', 
                  wrapText: true, 
                  readingOrder: 'rtl',
                  indent: 0
                }
              } else if (hasEnglish && !hasHebrew) {
                // Pure English - use LTR with proper formatting
                cell.alignment = { 
                  horizontal: 'left', 
                  vertical: 'top', 
                  wrapText: true, 
                  readingOrder: 'ltr',
                  indent: 0.5, // Small indent for better readability
                  shrinkToFit: false // Prevent text shrinking
                }
                // Set font for English text
                cell.font = { size: 11, name: 'Arial' }
              } else {
                // Hebrew or other - use RTL
                cell.alignment = { 
                  horizontal: 'right', 
                  vertical: 'top', 
                  wrapText: true, 
                  readingOrder: 'rtl',
                  indent: 0
                }
              }
            } else {
              // Default alignment for other columns
              cell.alignment = { horizontal: 'right', vertical: 'top', wrapText: true }
            }
          })

          // Apply styles efficiently - Arial font, no alternating colors
          row.font = { size: 11, name: 'Arial' }
          
          // No alternating colors - all white background
          
          // Calculate precise row height using the new function
          const columnWidths = columns.map(col => col.width)
          const calculatedHeight = calculateRowHeight(row, columnWidths)
          row.height = Math.max(calculatedHeight, 20) // מינימום 20 פיקסלים
          
          currentRow++
        })
      } else {
        // If no recommendations, add a single row for the meeting
        const rowData = {
          stockId: stock?.stockId || '',
          companyName: stock?.fullName || '',
          stockType: stock?.type || '',
          marketValue: formatMarketValue(stockValue?.marketValue || meeting.stockMarketValue),
          meetingDate: formatDate(meeting.meetingDate),
          holdingsLimit: formatDate(meeting.holdingsLimit),
          subjects: formatMixedText(agendaItems.map((item: any) => item.text).join('; ') || ''),
          recommendation: '',
          reasoning: '',
        }
        
        const row = worksheet.getRow(currentRow)
        
        // Set values for each column
        columns.forEach((col, index) => {
          const cell = row.getCell(index + 1)
          const value = rowData[col.key as keyof typeof rowData]
          cell.value = value
          
          // Special alignment for mixed Hebrew/English text
          if ((col.key === 'subjects' || col.key === 'reasoning') && value && typeof value === 'string') {
            const hasHebrew = /[\u0590-\u05FF]/.test(value)
            const hasEnglish = /[a-zA-Z]/.test(value)
            
            if (hasHebrew && hasEnglish) {
              // Mixed text - use RTL with proper text direction
              cell.alignment = { 
                horizontal: 'right', 
                vertical: 'top', 
                wrapText: true, 
                readingOrder: 'rtl',
                indent: 0
              }
            } else if (hasEnglish && !hasHebrew) {
              // Pure English - use LTR with proper formatting
              cell.alignment = { 
                horizontal: 'left', 
                vertical: 'top', 
                wrapText: true, 
                readingOrder: 'ltr',
                indent: 0.5, // Small indent for better readability
                shrinkToFit: false // Prevent text shrinking
              }
              // Set font for English text
              cell.font = { size: 11, name: 'Arial' }
            } else {
              // Hebrew or other - use RTL
              cell.alignment = { 
                horizontal: 'right', 
                vertical: 'top', 
                wrapText: true, 
                readingOrder: 'rtl',
                indent: 0
              }
            }
          } else {
            // Default alignment for other columns
            cell.alignment = { horizontal: 'right', vertical: 'top', wrapText: true }
          }
        })

        // Apply styles efficiently - Arial font, no alternating colors
        row.font = { size: 11, name: 'Arial' }
        
        // No alternating colors - all white background
        
        // Calculate precise row height using the new function
        const columnWidths = columns.map(col => col.width)
        const calculatedHeight = calculateRowHeight(row, columnWidths)
        row.height = Math.max(calculatedHeight, 20) // מינימום 20 פיקסלים
        
        currentRow++
      }
    })

    // Add borders to all cells - regular black borders
    const totalRows = currentRow - 1 // currentRow is now the next available row
    
    // Apply borders to title row
    const titleRow = worksheet.getRow(1)
    titleRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      }
    })
    
    // Apply borders to header row
    const headerRowForBorders = worksheet.getRow(2)
    headerRowForBorders.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      }
    })
    
    // Separator row borders are already applied above
    
    // Apply borders to data rows (starting from row 4)
    for (let rowNum = 4; rowNum <= totalRows; rowNum++) {
      const row = worksheet.getRow(rowNum)
      
      // Apply regular black borders to all cells in the row
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        }
      })
    }

    console.log(`Excel creation completed in ${Date.now() - excelStart}ms`)
    console.log('Generating buffer...')
    const bufferStart = Date.now()

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    console.log(`Buffer generation completed in ${Date.now() - bufferStart}ms`)
    console.log(`Total export time: ${Date.now() - startTime}ms`)
    console.log(`Buffer size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`)

    // Set response headers for file download
    const filename = `אסיפות_${new Date().toISOString().split('T')[0]}.xlsx`
    
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Error exporting meetings to Excel:', error)
    console.log(`Export failed after ${Date.now() - startTime}ms`)
    return new Response(JSON.stringify({ error: 'Failed to export Excel file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}