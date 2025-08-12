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
    boardPolicy?: string
    conflictOfInterest?: string
    relatedParty?: string
    personalInterest?: string
  }[]
}

// PDF configuration constants
const A4 = [595.28, 841.89]
const PAGE_WIDTH = A4[1]
const PAGE_HEIGHT = A4[0]
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const MIN_ROW_HEIGHT = 20
const DATA_LINE_HEIGHT = 12
const LINE_HEIGHT_HEADER = 9
const FONT_SIZE_HEADER = 7
const FONT_SIZE_DATA = 7
const COMPANY_INFO_HEIGHT = 35
const PADDING = 5

async function initializePDFDocument(): Promise<{
  pdfDoc: PDFDocument
  alefRegular: any
  alefBold: any
  logoImage: any
}> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  // --- התיקון האוניברסלי מתחיל כאן ---

  // 1. נבדוק אם אנחנו בסביבת פרודקשן
  const isProduction = process.env.NODE_ENV === 'production'

  // 2. נקבע את נתיב הבסיס לקבצים בהתאם לסביבה
  const assetsBasePath = isProduction
    ? process.cwd() // בפרודקשן, הנתיב הוא שורש תיקיית הבילד
    : path.join(process.cwd(), 'public') // בפיתוח, הנתיב הוא תיקיית public

  console.log(`Running in ${isProduction ? 'Production' : 'Development'} mode.`)
  console.log(`Assets base path: ${assetsBasePath}`)

  // 3. נטען את הקבצים באמצעות הנתיב הדינמי שיצרנו
  const alefRegularBytes = fs.readFileSync(
    path.join(assetsBasePath, 'fonts', 'regular-webfont.ttf'),
  )
  const alefBoldBytes = fs.readFileSync(path.join(assetsBasePath, 'fonts', 'bold-webfont.ttf'))

  const alefRegular = await pdfDoc.embedFont(alefRegularBytes)
  const alefBold = await pdfDoc.embedFont(alefBoldBytes)

  const logoPath = path.join(assetsBasePath, 'emda_logo.png')
  const logoBytes = fs.readFileSync(logoPath)
  const logoImage = await pdfDoc.embedPng(logoBytes)

  // --- סוף התיקון ---

  return { pdfDoc, alefRegular, alefBold, logoImage }
}

function fixBiDiText(text: any): string {
  if (typeof text !== 'string' || !text) {
    return text || ''
  }
  return text
    .replace(/\(/g, '__OPEN_PAREN__')
    .replace(/\)/g, '(')
    .replace(/__OPEN_PAREN__/g, ')')
}

function addPage(pdfDoc: PDFDocument): PDFPage {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

function formatNormalDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return ['']
  const lines: string[] = []

  const hardLines = text.split('\n')

  for (const hardLine of hardLines) {
    if (font.widthOfTextAtSize(hardLine, fontSize) <= maxWidth) {
      lines.push(hardLine)
      continue
    }

    const words = hardLine.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine === '' ? word : `${currentLine} ${word}`
      const width = font.widthOfTextAtSize(testLine, fontSize)

      if (width <= maxWidth) {
        currentLine = testLine
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    lines.push(currentLine)
  }

  return lines.filter((line) => line.trim() !== '')
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
        agendas: item.agendas || [],
      })
    } else {
      const existing = groupedData.get(key)!
      existing.agendas = [...existing.agendas, ...(item.agendas || [])]
    }
  })
  return Array.from(groupedData.values())
}

async function addDocumentHeader(
  page: PDFPage,
  options: PDFExportOptions,
  fonts: { regular: any; bold: any },
  logoImage: any,
): Promise<number> {
  const { dateRange } = options
  const logoWidth = 80
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth

  page.drawImage(logoImage, {
    x: PAGE_WIDTH - MARGIN - logoWidth,
    y: PAGE_HEIGHT - MARGIN - logoHeight,
    width: logoWidth,
    height: logoHeight,
  })

  const titleText = `דו"ח השתתפות באסיפות`
  const fontSize = 11
  const textWidth = fonts.bold.widthOfTextAtSize(titleText, fontSize)
  const titleX = (PAGE_WIDTH - textWidth) / 2
  const titleY = PAGE_HEIGHT - MARGIN - 5

  page.drawText(fixBiDiText(titleText), {
    x: titleX,
    y: titleY,
    size: fontSize,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  })

  const companyNameText = 'comapny name'
  const companyNameTextWidth = fonts.bold.widthOfTextAtSize(companyNameText, fontSize)
  const companyNameX = (PAGE_WIDTH - companyNameTextWidth) / 2
  const companyNameY = titleY - 12

  page.drawText(fixBiDiText(companyNameText), {
    x: companyNameX,
    y: companyNameY,
    size: fontSize,
    font: fonts.regular,
    color: rgb(0, 0, 0),
  })

  const dateRangeText = `${formatNormalDate(dateRange.startDate)} - ${formatNormalDate(dateRange.endDate)}`
  const dateRangeTextWidth = fonts.bold.widthOfTextAtSize(dateRangeText, fontSize)
  const dateRangeX = (PAGE_WIDTH - dateRangeTextWidth) / 2
  const dateRangeY = titleY - 24
  page.drawText(fixBiDiText(dateRangeText), {
    x: dateRangeX,
    y: dateRangeY,
    size: fontSize,
    font: fonts.regular,
    color: rgb(0.3, 0.3, 0.3),
  })

  return PAGE_HEIGHT - MARGIN - 50
}

async function addPageFooter(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  fonts: { regular: any },
): Promise<void> {
  const footerText = `${pageNumber} / ${totalPages}`
  const textWidth = fonts.regular.widthOfTextAtSize(footerText, 10)

  page.drawText(footerText, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: MARGIN,
    size: 10,
    font: fonts.regular,
    color: rgb(0.5, 0.5, 0.5),
  })
}

function calculateTableHeights(
  headers: string[],
  fonts: { bold: any },
  columnWidths: number[],
): { companyHeaderHeight: number; agendaHeaderHeight: number } {
  const wrappedHeaders = headers.map((header, i) =>
    wrapText(fixBiDiText(header), fonts.bold, FONT_SIZE_HEADER, columnWidths[i] - PADDING * 2),
  )

  const maxLinesInHeader = Math.max(...wrappedHeaders.map((lines) => lines.length))
  const agendaHeaderHeight = maxLinesInHeader * LINE_HEIGHT_HEADER + 8

  return {
    companyHeaderHeight: COMPANY_INFO_HEIGHT,
    agendaHeaderHeight: agendaHeaderHeight,
  }
}

function drawCompanyInfo(
  page: PDFPage,
  meetingData: GroupedMeetingData,
  startY: number,
  fonts: { regular: any; bold: any },
): number {
  const companyHeaderBgColor = rgb(235 / 255, 232 / 255, 240 / 255)

  page.drawRectangle({
    x: MARGIN,
    y: startY - COMPANY_INFO_HEIGHT + 5,
    width: CONTENT_WIDTH,
    height: COMPANY_INFO_HEIGHT,
    color: companyHeaderBgColor,
  })

  const companyInfoY = startY - 10
  const formattedDate = meetingData.meetingDate
    ? formatNormalDate(new Date(meetingData.meetingDate))
    : ''

  const companyHeaders = [
    'שם נייר',
    'מספר נייר',
    'סוג האסיפה',
    'מועד האסיפה',
    'שווי אחזקה (מיליוני)',
    'אחזקה באחוזים',
    'שווי שוק (מיליוני)',
  ]
  const companyValues = [
    meetingData.stockName || '',
    meetingData.stockNumber || '',
    meetingData.meetingType || '',
    formattedDate,
    meetingData.holdingValueInMillions?.toString() || '',
    `${meetingData.percentageHolding || 0}%`,
    meetingData.marketValue || '',
  ]

  let headerX = PAGE_WIDTH - MARGIN
  const colWidth = 110
  companyHeaders.forEach((header, i) => {
    const fixedHeader = fixBiDiText(header)
    const headerWidth = fonts.bold.widthOfTextAtSize(fixedHeader, 8)
    page.drawText(fixedHeader, {
      x: headerX - headerWidth - PADDING,
      y: companyInfoY,
      size: 8,
      font: fonts.bold,
      color: rgb(0.1, 0.1, 0.1),
    })

    const value = companyValues[i]
    const fixedValue = fixBiDiText(value)
    const valueWidth = fonts.regular.widthOfTextAtSize(fixedValue, 8)
    page.drawText(fixedValue, {
      x: headerX - valueWidth - PADDING,
      y: companyInfoY - 12,
      size: 8,
      font: fonts.regular,
      color: rgb(0.2, 0.2, 0.2),
    })
    headerX -= colWidth
  })

  return startY - COMPANY_INFO_HEIGHT + 3
}

function drawAgendaTableHeader(
  page: PDFPage,
  startY: number,
  fonts: { bold: any },
  heights: { agendaHeaderHeight: number },
  headers: string[],
  columnWidths: number[],
): number {
  const agendaHeaderBgColor = rgb(220 / 255, 215 / 255, 227 / 255)
  const headerTextColor = rgb(0.1, 0.1, 0.1)

  const wrappedHeaders = headers.map((header, i) =>
    wrapText(fixBiDiText(header), fonts.bold, FONT_SIZE_HEADER, columnWidths[i] - PADDING * 2),
  )

  page.drawRectangle({
    x: MARGIN,
    y: startY - heights.agendaHeaderHeight,
    width: CONTENT_WIDTH,
    height: heights.agendaHeaderHeight,
    color: agendaHeaderBgColor,
  })

  let currentX = PAGE_WIDTH - MARGIN
  wrappedHeaders.forEach((lines, i) => {
    const colWidth = columnWidths[i]
    const blockHeight = lines.length * LINE_HEIGHT_HEADER
    let lineY = startY - (heights.agendaHeaderHeight - blockHeight) / 2 - FONT_SIZE_HEADER

    lines.forEach((line) => {
      const textWidth = fonts.bold.widthOfTextAtSize(line, FONT_SIZE_HEADER)
      const textX = currentX - colWidth + (colWidth - textWidth) / 2
      page.drawText(line, {
        x: textX,
        y: lineY,
        size: FONT_SIZE_HEADER,
        font: fonts.bold,
        color: headerTextColor,
      })
      lineY -= LINE_HEIGHT_HEADER
    })
    currentX -= colWidth
  })

  return startY - heights.agendaHeaderHeight
}

function drawAgendaRow(
  page: PDFPage,
  startY: number,
  agenda: any,
  rowIndex: number,
  fonts: { regular: any },
  columnWidths: number[],
  rowHeight: number,
): number {
  const rowEvenBgColor = rgb(245 / 255, 242 / 255, 250 / 255)
  const rowOddBgColor = rgb(253 / 255, 252 / 255, 254 / 255)
  const rowTextColor = rgb(0.2, 0.2, 0.2)

  page.drawRectangle({
    x: MARGIN,
    y: startY - rowHeight,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: (rowIndex + 1) % 2 === 0 ? rowEvenBgColor : rowOddBgColor,
  })

  const rowData = [
    (rowIndex + 1).toString(),
    agenda.text || '',
    agenda.recommendation?.votingRecommendation || '',
    agenda.vote || '',
    agenda.result || agenda.meetingResults || '',
    agenda.regularMajority || '',
    agenda.specialMajority || '',
    agenda.boardPolicy || '',
    agenda.conflictOfInterest || '',
    agenda.relatedParty || '',
    agenda.personalInterest || '',
  ]

  let x = PAGE_WIDTH - MARGIN
  const verticalCenterY = startY - rowHeight / 2 - FONT_SIZE_DATA / 2

  const numberColWidth = columnWidths[0]
  const numberText = rowData[0]
  const numberWidth = fonts.regular.widthOfTextAtSize(numberText, FONT_SIZE_DATA)
  const numberX = x - numberColWidth + (numberColWidth - numberWidth) / 2
  page.drawText(numberText, {
    x: numberX,
    y: verticalCenterY,
    font: fonts.regular,
    size: FONT_SIZE_DATA,
    color: rowTextColor,
  })
  x -= numberColWidth

  const agendaColWidth = columnWidths[1]
  const wrappedAgendaLines = wrapText(
    fixBiDiText(rowData[1]),
    fonts.regular,
    FONT_SIZE_DATA,
    agendaColWidth - PADDING * 2,
  )
  let lineY = startY - PADDING - FONT_SIZE_DATA

  wrappedAgendaLines.forEach((line) => {
    const textWidth = fonts.regular.widthOfTextAtSize(line, FONT_SIZE_DATA)
    const textX = x - textWidth - PADDING
    page.drawText(line, {
      x: textX,
      y: lineY,
      font: fonts.regular,
      size: FONT_SIZE_DATA,
      color: rowTextColor,
      lineHeight: DATA_LINE_HEIGHT,
    })
    lineY -= DATA_LINE_HEIGHT
  })
  x -= agendaColWidth

  for (let i = 2; i < rowData.length; i++) {
    const cell = rowData[i]
    const colWidth = columnWidths[i]
    const textToDraw = fixBiDiText(String(cell))
    const textWidth = fonts.regular.widthOfTextAtSize(textToDraw, FONT_SIZE_DATA)
    const textX = x - colWidth + (colWidth - textWidth) / 2

    page.drawText(textToDraw, {
      x: textX,
      y: verticalCenterY,
      size: FONT_SIZE_DATA,
      font: fonts.regular,
      color: rowTextColor,
    })
    x -= colWidth
  }

  return startY - rowHeight
}

export async function generateParticipationsPDF(
  data: any[],
  options: PDFExportOptions,
): Promise<Uint8Array> {
  try {
    const { pdfDoc, alefRegular, alefBold, logoImage } = await initializePDFDocument()
    const fonts = { regular: alefRegular, bold: alefBold }
    const groupedData = groupDataByMeeting(data)

    if (groupedData.length === 0) {
      const page = addPage(pdfDoc)
      await addDocumentHeader(page, options, fonts, logoImage)
      page.drawText(fixBiDiText('אין נתונים להצגה'), {
        x: (PAGE_WIDTH - 100) / 2,
        y: PAGE_HEIGHT / 2,
        font: fonts.bold,
        size: 16,
      })
      await addPageFooter(page, 1, 1, fonts)
      return await pdfDoc.save()
    }

    const columns = [
      '',
      'נושא',
      'המלצת גורם מייעץ',
      'הצבעה',
      'תוצאות האסיפה',
      'רוב רגיל',
      'רוב מיוחד',
      'בהתאם למדיניות דירקטוריון ו/או וועדת השקעות',
      'ניגוד עניינים',
      'צד קשר',
      'עניין אישי',
    ]
    const columnWidths = [25, 375, 45, 45, 45, 45, 40, 60, 40, 40, 40]

    let currentPage = addPage(pdfDoc)
    let currentY = await addDocumentHeader(currentPage, options, fonts, logoImage)

    for (const meeting of groupedData) {
      const tableHeights = calculateTableHeights(columns, fonts, columnWidths)
      const requiredHeightForStart =
        tableHeights.companyHeaderHeight + tableHeights.agendaHeaderHeight + MIN_ROW_HEIGHT

      if (currentY < MARGIN + 40 + requiredHeightForStart) {
        currentPage = addPage(pdfDoc)
        currentY = await addDocumentHeader(currentPage, options, fonts, logoImage)
      }

      const isFirstTableOnPage = currentY >= PAGE_HEIGHT - MARGIN - 75
      if (!isFirstTableOnPage) {
        currentY -= 30
      }

      currentY = drawCompanyInfo(currentPage, meeting, currentY, fonts)
      currentY = drawAgendaTableHeader(
        currentPage,
        currentY,
        fonts,
        tableHeights,
        columns,
        columnWidths,
      )

      for (let i = 0; i < meeting.agendas.length; i++) {
        const agenda = meeting.agendas[i]

        const wrappedLines = wrapText(
          fixBiDiText(agenda.text || ''),
          fonts.regular,
          FONT_SIZE_DATA,
          columnWidths[1] - PADDING * 2,
        )
        const dynamicRowHeight = Math.max(
          MIN_ROW_HEIGHT,
          wrappedLines.length * DATA_LINE_HEIGHT + PADDING * 2,
        )

        if (currentY < MARGIN + 40 + dynamicRowHeight) {
          currentPage = addPage(pdfDoc)
          currentY = await addDocumentHeader(currentPage, options, fonts, logoImage)
        }

        currentY = drawAgendaRow(
          currentPage,
          currentY,
          agenda,
          i,
          fonts,
          columnWidths,
          dynamicRowHeight,
        )
      }
    }

    const totalPages = pdfDoc.getPageCount()
    const pages = pdfDoc.getPages()
    for (let i = 0; i < totalPages; i++) {
      await addPageFooter(pages[i], i + 1, totalPages, fonts)
    }

    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  } catch (error) {
    throw new Error('Failed to generate PDF')
  }
}
