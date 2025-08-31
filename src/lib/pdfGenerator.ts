import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import {
  booleanToIcon,
  COMPANY_SUB_HEADERS,
  ExportOptions,
  formatNormalDate,
  groupDataByMeeting,
  resultMapping,
  SHARED_COLUMNS,
} from './exportTypes'
import { parseNumber } from '@/app/(frontend)/helpers/utils-data-table'
import { formatNumberWithLocale } from './utils'

// PDF configuration constants
const A4 = [595.28, 841.89]
const PAGE_WIDTH = A4[1]
const PAGE_HEIGHT = A4[0]
const MARGIN = 15

const MIN_ROW_HEIGHT = 15

const FONT_SIZE_HEADER = 7
const FONT_SIZE_SUBHEADER = 6
const FONT_SIZE_DATA = 7
const PADDING = 5
const HEADER_HEIGHT = 60

async function initializePDFDocument(): Promise<{
  alefRegularBytes: Buffer
  alefBoldBytes: Buffer
  logoBytes: Buffer
}> {
  const cwd = process.cwd() as unknown as string
  logger.warn(`Current working directory: ${cwd}`)

  const regularFontPath = path.join('public', 'fonts', 'ariel.ttf')
  const boldFontPath = path.join('public', 'fonts', 'ariel-bold.ttf')
  const logoPath = path.join('public', 'emda_logo.png')

  logger.warn(`Regular font path: ${regularFontPath}, exists: ${fs.existsSync(regularFontPath)}`)
  logger.warn(`Bold font path: ${boldFontPath}, exists: ${fs.existsSync(boldFontPath)}`)
  logger.warn(`Logo path: ${logoPath}, exists: ${fs.existsSync(logoPath)}`)

  if (!fs.existsSync(regularFontPath) || !fs.existsSync(boldFontPath) || !fs.existsSync(logoPath)) {
    throw new Error(
      'Could not find font files or logo in public directory. Please check the paths and file permissions.',
    )
  }

  let alefRegularBytes, alefBoldBytes, logoBytes

  try {
    alefRegularBytes = fs.readFileSync(regularFontPath)
    alefBoldBytes = fs.readFileSync(boldFontPath)
    logoBytes = fs.readFileSync(logoPath)
    logger.warn('Successfully loaded assets from public directory')
  } catch (error: any) {
    logger.warn('Error reading files from public directory:', error)
    throw new Error('Failed to read font files or logo from public directory')
  }

  return { alefRegularBytes, alefBoldBytes, logoBytes }
}

function fixBiDiText(text: any): string {
  if (!text && text !== 0) {
    return ''
  }
  if (typeof text !== 'string') {
    text = String(text)
  }
  return text
    .replace(/\(/g, '__OPEN_PAREN__')
    .replace(/\)/g, '(')
    .replace(/__OPEN_PAREN__/g, ')')
}

function prepareTextWithLineBreaks(text: string, doc: jsPDF, maxWidth: number): string {
  if (!text) {
    return ''
  }

  if (typeof text !== 'string') {
    text = String(text)
  }

  text = fixBiDiText(text)

  if (/^[0-9.,/%-]+$/.test(text) || text === 'V' || text === 'X' || text === '') {
    return text
  }

  const lines = doc.splitTextToSize(text, maxWidth)
  const reversedLines = lines.map((line: string) => {
    return line.split('').reverse().join('')
  })

  return reversedLines.join('\n')
}

function prepareText(text: string): string {
  text = fixBiDiText(text)
  if (/^[0-9.,/%-]+$/.test(text) || text === 'V' || text === 'X' || text === '') {
    return text
  }
  return text.split('').reverse().join('')
}

function addHeader(
  doc: jsPDF,
  options: ExportOptions,
  logoImage: string,
  logoWidth: number,
  logoHeight: number,
) {
  const { dateRange } = options

  doc.addImage(logoImage, 'PNG', PAGE_WIDTH - MARGIN - logoWidth, MARGIN, logoWidth, logoHeight)

  doc.setFont('Ariel', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)

  const titleText = prepareText(`דו"ח השתתפות באסיפות`)
  const titleWidth = doc.getTextWidth(titleText)
  doc.text(titleText, (PAGE_WIDTH - titleWidth) / 2, MARGIN + 5)

  const reportNameText = prepareText(options.reportName)
  const reportNameWidth = doc.getTextWidth(reportNameText)
  doc.text(reportNameText, (PAGE_WIDTH - reportNameWidth) / 2, MARGIN + 17)

  doc.setFontSize(10)
  const dateRangeText = prepareText(
    `${formatNormalDate(dateRange.startDate)} - ${formatNormalDate(dateRange.endDate)}`,
  )
  const dateRangeWidth = doc.getTextWidth(dateRangeText)
  doc.text(dateRangeText, (PAGE_WIDTH - dateRangeWidth) / 2, MARGIN + 29)
}

export async function generateParticipationsPDF(
  data: any[],
  options: ExportOptions,
): Promise<Uint8Array> {
  try {
    const { alefRegularBytes, alefBoldBytes, logoBytes } = await initializePDFDocument()

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    })

    const alefRegularBase64 = alefRegularBytes.toString('base64')
    const alefBoldBase64 = alefBoldBytes.toString('base64')
    const logoBase64 = logoBytes.toString('base64')

    doc.addFileToVFS('Ariel.ttf', alefRegularBase64)
    doc.addFont('Ariel.ttf', 'Ariel', 'normal')
    doc.addFileToVFS('Ariel-bold.ttf', alefBoldBase64)
    doc.addFont('Ariel-bold.ttf', 'Ariel', 'bold')
    doc.setFont('Ariel', 'normal')

    const imageProps = doc.getImageProperties(logoBase64)
    const logoWidth = 80
    const logoHeight = (imageProps.height / imageProps.width) * logoWidth

    const groupedData = groupDataByMeeting(data)

    if (groupedData.length === 0) {
      addHeader(doc, options, logoBase64, logoWidth, logoHeight)
      doc.setFont('Ariel', 'normal')
      doc.setFontSize(16)
      doc.setTextColor(0, 0, 0)
      const noDataText = prepareText('אין נתונים להצגה')
      const noDataWidth = doc.getTextWidth(noDataText)
      doc.text(noDataText, (PAGE_WIDTH - noDataWidth) / 2, PAGE_HEIGHT / 2)

      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont('Ariel', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(128, 128, 128)
        const footerText = `${i} / ${totalPages}`
        const footerWidth = doc.getTextWidth(footerText)
        doc.text(footerText, (PAGE_WIDTH - footerWidth) / 2, PAGE_HEIGHT - MARGIN)
      }

      return new Uint8Array(doc.output('arraybuffer'))
    }

    const subWidth = 330 / 5
    const widths = [
      40, // עמודה 0 - אינטרס אישי
      40, // עמודה 1 - צד קשור
      40, // עמודה 2 - ניגוד עניינים
      60, // עמודה 3 - ציות למדיניות
      40, // עמודה 4 - רוב מיוחד
      45, // עמודה 5 - רוב רגיל
      45, // עמודה 6 - תוצאות ישיבה
      45, // עמודה 7 - הצבעה
      45, // עמודה 8 - המלצת יועץ
      subWidth, // עמודה 9 - מספר מניה
      subWidth, // עמודה 10 - שם מניה
      subWidth, // עמודה 11 - שווי שוק
      subWidth, // עמודה 12 - אחוז החזקה
      subWidth, // עמודה 13 - שווי החזקה
      subWidth, // עמודה 14 - תאריך ישיבה
      subWidth, // עמודה 15 - סוג ישיבה
      15, // עמודה 16 - מספר סעיף
    ]

    const columnStyles: { [key: string]: Partial<import('jspdf-autotable').Styles> } = {
      '0': { halign: 'center' as const },
      '1': { halign: 'center' as const },
      '2': { halign: 'center' as const },
      '3': { halign: 'center' as const },
      '4': { halign: 'center' as const },
      '5': { halign: 'center' as const },
      '6': { halign: 'center' as const },
      '7': { halign: 'center' as const },
      '8': { halign: 'center' as const },
      '9': { halign: 'center' as const },
      '10': { halign: 'center' as const },
      '11': { halign: 'center' as const },
      '12': { halign: 'center' as const },
      '13': { halign: 'center' as const },
      '14': { halign: 'center' as const },
      '15': { halign: 'center' as const },
      '16': { halign: 'center' as const },
    }

    // יצירת הכותרות - שורה ראשונה עם המיזוג
    const headerRow1 = [
      { content: prepareText(SHARED_COLUMNS.PERSONAL_INTEREST), rowSpan: 2 },
      { content: prepareText(SHARED_COLUMNS.RELATED_PARTY), rowSpan: 2 },
      { content: prepareText(SHARED_COLUMNS.CONFLICT_OF_INTEREST), rowSpan: 2 },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.POLICY_COMPLIANCE, doc, 70),
        rowSpan: 2,
      },
      { content: prepareText(SHARED_COLUMNS.SPECIAL_MAJORITY), rowSpan: 2 },
      { content: prepareText(SHARED_COLUMNS.REGULAR_MAJORITY), rowSpan: 2 },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.MEETING_RESULTS, doc, 55), rowSpan: 2 },
      { content: prepareText(SHARED_COLUMNS.VOTE), rowSpan: 2 },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.ADVISOR_RECOMMENDATION, doc, 55),
        rowSpan: 2,
      },
      {
        content: prepareText('נושא'),
        colSpan: 7, // מיזוג 7 עמודות - עמודות 9-15
        halign: 'center',
        styles: {
          fontSize: FONT_SIZE_HEADER,
          cellPadding: { top: PADDING + 13 },
        },
      },
      { content: '', rowSpan: 2 }, // עמודה 16 - מספר סעיף
    ]

    const headerRow2 = [
      // תתי כותרות מסודרות בסדר הנכון (לא הפוך)
      {
        content: prepareText(COMPANY_SUB_HEADERS[0]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // מספר מניה
      {
        content: prepareText(COMPANY_SUB_HEADERS[1]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שם מניה
      {
        content: prepareText(COMPANY_SUB_HEADERS[2]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שווי שוק
      {
        content: prepareText(COMPANY_SUB_HEADERS[3]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // אחוז החזקה
      {
        content: prepareText(COMPANY_SUB_HEADERS[4]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שווי החזקה
      {
        content: prepareText(COMPANY_SUB_HEADERS[5]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // תאריך ישיבה
      {
        content: prepareText(COMPANY_SUB_HEADERS[6]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // סוג ישיבה
    ]

    const head = [headerRow1, headerRow2.reverse()]

    const body: any[] = []

    for (const meeting of groupedData) {
      const companyHeaderBgColor = [210, 228, 255]
      const textColor = [51, 51, 51]

      const formattedDate = meeting.meetingDate
        ? formatNormalDate(new Date(meeting.meetingDate))
        : ''
      const formattedMarketValue = formatNumberWithLocale(
        parseNumber(meeting.marketValue) / 1_000_000,
        0,
      )
      const formattedPercentageHolding = formatNumberWithLocale(meeting.percentageHolding, 4)
      const formattedHoldingValueInMillions = formatNumberWithLocale(
        meeting.holdingValueInMillions,
        2,
      )

      // ארגון נתוני החברה בסדר הנכון (עמודות 9-15)
      const companyValues = [
        meeting.meetingType || '', // עמודה 15
        formattedDate, // עמודה 14
        formattedHoldingValueInMillions, // עמודה 13
        formattedPercentageHolding, // עמודה 12
        formattedMarketValue, // עמודה 11
        meeting.stockName || '', // עמודה 10
        meeting.stockNumber || '', // עמודה 9
      ]

      // יצירת שורת כותרת חברה עם רקע צבעוני
      const companyRow = [
        // עמודות 0-8 ריקות עם רקע צבעוני
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        // עמודות 9-15 עם נתוני החברה
        {
          content:
            companyValues[0].length > 15
              ? prepareTextWithLineBreaks(companyValues[0], doc, 15)
              : prepareText(companyValues[0]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content:
            companyValues[1].length > 15
              ? prepareTextWithLineBreaks(companyValues[1], doc, 15)
              : prepareText(companyValues[1]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareText(companyValues[2]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareText(companyValues[3]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareText(companyValues[4]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareText(companyValues[5]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content:
            companyValues[6].length > 15
              ? prepareTextWithLineBreaks(companyValues[6], doc, 15)
              : prepareText(companyValues[6]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        // עמודה 16 ריקה
        { content: '', styles: { fillColor: companyHeaderBgColor } },
      ]
      body.push(companyRow)

      // הוספת שורות הסעיפים
      meeting.agendas.forEach((agenda: any, i: number) => {
        const rowBg = i % 2 === 0 ? [245, 250, 255] : [231, 240, 255]
        const defaultTextColor = [51, 51, 51]

        // ארגון נתוני הסעיף בסדר הנכון (עמודות 0-8, 16)
        const agendaData = [
          booleanToIcon(agenda.personalInterest), // עמודה 0
          booleanToIcon(agenda.relatedParty), // עמודה 1
          booleanToIcon(agenda.conflictOfInterest), // עמודה 2
          booleanToIcon(agenda.policyCompliance), // עמודה 3
          agenda.privilegedMajority && agenda.vPercentSpecial ? `${agenda.vPercentSpecial}` : '', // עמודה 4
          booleanToIcon(!agenda.privilegedMajority), // עמודה 5
          agenda.result
            ? resultMapping[agenda.result] || agenda.result
            : agenda.meetingResults || '', // עמודה 6
          agenda.vote || '', // עמודה 7
          agenda.recommendation?.votingRecommendation || '', // עמודה 8
        ]

        const row = [
          ...agendaData.map((content) => {
            let thisTextColor = defaultTextColor
            if (content === 'V') {
              thisTextColor = [0, 153, 0]
            } else if (content === 'X') {
              thisTextColor = [204, 0, 0]
            }

            return {
              content: prepareText(content),
              styles: { fillColor: rowBg, textColor: thisTextColor },
            }
          }),
          // עמודה 9 - טקסט הסעיף עם מיזוג 7 עמודות
          {
            content: prepareTextWithLineBreaks(agenda.text || '', doc, subWidth * 11),
            colSpan: 7, // מיזוג עמודות 9-15
            styles: {
              fillColor: rowBg,
              textColor: defaultTextColor,
              halign: 'right',
              valign: 'top',
            },
          },
          // עמודה 16 - מספר הסעיף
          {
            content: prepareText('.' + (i + 1).toString()),
            styles: { fillColor: rowBg, textColor: defaultTextColor, halign: 'center' },
          },
        ]

        body.push(row)
      })

      // הוספת שורה ריקה להפרדה בין חברות
      body.push([
        {
          content: '',
          colSpan: 17, // מיזוג כל העמודות
          styles: { minCellHeight: 10, fillColor: [255, 255, 255] },
        },
      ])
    }

    autoTable(doc, {
      head,
      body,
      startY: HEADER_HEIGHT,
      margin: { top: HEADER_HEIGHT, left: MARGIN, right: MARGIN, bottom: MARGIN + 20 },
      theme: 'plain',
      columnStyles,
      headStyles: {
        font: 'Ariel',
        fontStyle: 'bold',
        fontSize: FONT_SIZE_HEADER,
        fillColor: [249, 250, 250],
        textColor: [26, 26, 26],
        cellPadding: PADDING,
        valign: 'middle',
        halign: 'center',
        minCellHeight: MIN_ROW_HEIGHT,
      },
      bodyStyles: {
        font: 'Ariel',
        fontStyle: 'normal',
        fontSize: FONT_SIZE_DATA,
        cellPadding: PADDING,
        valign: 'middle',
        overflow: 'linebreak',
        minCellHeight: MIN_ROW_HEIGHT,
      },
      didDrawPage: () => {
        addHeader(doc, options, logoBase64, logoWidth, logoHeight)
      },
    })

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('Ariel', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(128, 128, 128)
      const footerText = `${i} / ${totalPages}`
      const footerWidth = doc.getTextWidth(footerText)
      doc.text(footerText, (PAGE_WIDTH - footerWidth) / 2, PAGE_HEIGHT - MARGIN)
    }

    return new Uint8Array(doc.output('arraybuffer'))
  } catch (error) {
    console.trace(error)
    logger.error({ err: error, msg: 'Error generating PDF:' })
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
