import { PDFDocument, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'

// Interfaces for PDF export
export interface PDFExportOptions {
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
  agendas: any[]
}

// PDF configuration constants
const A4 = [595.28, 841.89]
const PAGE_WIDTH = A4[1] // Landscape
const PAGE_HEIGHT = A4[0]
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

// ========== פונקציות טעינת PDF עם פונט ==========
async function initializePDFDocument(): Promise<{ pdfDoc: PDFDocument; alefRegular: any; alefBold: any; logoImage: any }> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const fontsDir = path.resolve(process.cwd(), 'public/fonts')
  const alefRegularBytes = fs.readFileSync(path.join(fontsDir, 'regular-webfont.ttf'))
  const alefBoldBytes = fs.readFileSync(path.join(fontsDir, 'bold-webfont.ttf'))

  const alefRegular = await pdfDoc.embedFont(alefRegularBytes)
  const alefBold = await pdfDoc.embedFont(alefBoldBytes)

  const logoPath = path.resolve(process.cwd(), 'public/emda_logo.png')
  const logoBytes = fs.readFileSync(logoPath)
  const logoImage = await pdfDoc.embedPng(logoBytes)

  return { pdfDoc, alefRegular, alefBold, logoImage }
}

function addPage(pdfDoc: PDFDocument): PDFPage {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

function formatHebrewDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function getRTLTextPosition(text: string, font: any, fontSize: number, fromX: number): number {
  const textWidth = font.widthOfTextAtSize(text, fontSize)
  return fromX - textWidth
}

// כותרת המסמך עם לוגו
async function addDocumentHeader(
  page: PDFPage,
  options: PDFExportOptions,
  fonts: { regular: any; bold: any },
  logoImage: any
): Promise<number> {
  const { dateRange } = options

  const logoWidth = 80
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth

  // מציבים את הלוגו בצד שמאל למעלה
  page.drawImage(logoImage, {
    x: PAGE_WIDTH - MARGIN - logoWidth,
    y: PAGE_HEIGHT - MARGIN - logoHeight,
    width: logoWidth,
    height: logoHeight
  })

  const titleText = `דו"ח השתתפות באסיפות`
  const fontSize = 11
  const textWidth = fonts.bold.widthOfTextAtSize(titleText, fontSize)
  const titleX = (PAGE_WIDTH - textWidth) / 2
  const titleY = PAGE_HEIGHT - MARGIN - 5

  page.drawText(titleText, {
    x: titleX,
    y: titleY,
    size: fontSize,
    font: fonts.bold,
    color: rgb(0, 0, 0)
  })

  const dateRangeText = `${formatHebrewDate(dateRange.startDate)} - ${formatHebrewDate(dateRange.endDate)}`
  page.drawText(dateRangeText, {
    x: titleX,
    y: titleY - 20,
    size: 10,
    font: fonts.bold,
    color: rgb(0.3, 0.3, 0.3)
  })

  return PAGE_HEIGHT - MARGIN - 100
}

async function addPageFooter(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  fonts: { regular: any }
): Promise<void> {
  const footerText = `${totalPages}/${pageNumber}`
  page.drawText(footerText, {
    x: PAGE_WIDTH / 2 - 5,
    y: MARGIN - 5,
    size: 10,
    font: fonts.regular,
    color: rgb(0.5, 0.5, 0.5)
  })
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
        agendas: item.agendas || []
      })
    } else {
      const existing = groupedData.get(key)!
      existing.agendas = [...existing.agendas, ...(item.agendas || [])]
    }
  })
  return Array.from(groupedData.values())
}

export async function generateParticipationsPDF(
  data: any[],
  options: PDFExportOptions
): Promise<Uint8Array> {
  try {
    const { pdfDoc, alefRegular, alefBold, logoImage } = await initializePDFDocument()
    const fonts = { regular: alefRegular, bold: alefBold }

    const groupedData = groupDataByMeeting(data)

    if (groupedData.length === 0) {
      const page = addPage(pdfDoc)
      await addDocumentHeader(page, options, fonts, logoImage)
      page.drawText('אין נתונים להצגה', {
        x: PAGE_WIDTH / 2 - 50,
        y: PAGE_HEIGHT / 2,
        size: 14,
        font: fonts.regular,
        color: rgb(0.5, 0.5, 0.5)
      })
      await addPageFooter(page, 1, 1, fonts)
    } else {
      let currentPage = addPage(pdfDoc)
      let currentY = await addDocumentHeader(currentPage, options, fonts, logoImage)
      let pageNumber = 1

      for (let i = 0; i < groupedData.length; i++) {
        const meeting = groupedData[i]
        const estimatedHeight = 100 + (meeting.agendas.length * 25)
        if (currentY - estimatedHeight < MARGIN + 50) {
          await addPageFooter(currentPage, pageNumber, Math.ceil(groupedData.length / 3), fonts)
          currentPage = addPage(pdfDoc)
          currentY = await addDocumentHeader(currentPage, options, fonts, logoImage)
          pageNumber++
        }
        currentY = await generateMeetingTable(currentPage, meeting, currentY, fonts)
        currentY -= 30
      }
      await addPageFooter(currentPage, pageNumber, pageNumber, fonts)
    }

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF')
  }
}

async function generateMeetingTable(
  page: PDFPage,
  meetingData: GroupedMeetingData,
  startY: number,
  fonts: { regular: any; bold: any }
): Promise<number> {
  let currentY = startY

  const headers = ['נושא', 'המלצה', 'הצבעה', 'תוצאה']
  const columnWidths = [300, 100, 80, 80]

  const rowHeight = 20

  // ערכת צבעים סגולה
  const headerBgColor = rgb(229 / 255, 224 / 255, 236 / 255)
  const headerTextColor = rgb(0.1, 0.1, 0.1)
  const rowShadeBgColor = rgb(245 / 255, 242 / 255, 250 / 255)
  const rowTextColor = rgb(0.2, 0.2, 0.2)

  // רקע כותרת הטבלה
  page.drawRectangle({
    x: MARGIN,
    y: currentY - rowHeight + 5,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: headerBgColor
  })

  // כותרות ממורכזות
  let currentX = PAGE_WIDTH - MARGIN
  headers.forEach((header, i) => {
    const colWidth = columnWidths[i]
    const textWidth = fonts.bold.widthOfTextAtSize(header, 10)
    // חישוב מיקום X למרכוז הטקסט בעמודה
    const textX = currentX - colWidth + (colWidth - textWidth) / 2

    page.drawText(header, {
      x: textX,
      y: currentY - 10,
      size: 9,
      font: fonts.bold,
      color: headerTextColor
    })
    currentX -= colWidth // הזזת הסמן לעמודה הבאה (לשמאל)
  })

  currentY -= rowHeight

  // שורות הנתונים
  meetingData.agendas.forEach((agenda, idx) => {
    // צביעת רקע לשורות זוגיות לסירוגין
    if (idx % 2 !== 0) {
      page.drawRectangle({
        x: MARGIN,
        y: currentY - rowHeight + 5,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: rowShadeBgColor
      })
    }

    const rowData = [
      agenda.text || '',
      agenda.recommendation?.votingRecommendation || '',
      agenda.vote || '',
      agenda.result || agenda.meetingResults || ''
    ]

    let x = PAGE_WIDTH - MARGIN // איפוס מיקום X לכל שורה
    rowData.forEach((cell, i) => {
      const colWidth = columnWidths[i]
      // קיצוץ הטקסט בהתאם לרוחב העמודה
      const textToDraw = String(cell).substring(0, i === 3 ? 80 : 30)
      const textWidth = fonts.regular.widthOfTextAtSize(textToDraw, 9)
      const textX = x - colWidth + (colWidth - textWidth) / 2

      page.drawText(textToDraw, {
        x: textX,
        y: currentY - 10,
        size: 9,
        font: fonts.regular,
        color: rowTextColor
      })
      x -= colWidth
    })

    currentY -= rowHeight
  })

  return currentY
}