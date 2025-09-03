import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/logger'
import { COMPANY_SUB_HEADERS, ExportOptions, resultMapping, SHARED_COLUMNS } from './exportTypes'
import { parseNumber } from '@/app/(frontend)/helpers/utils-data-table'
import { booleanToIcon, formatNormalDate } from './exportUtils'
import { formatNumberWithLocale } from '@/utils/numberUtils'

// PDF configuration constants
const A4 = [595.28, 841.89]
const PAGE_WIDTH = A4[1]
const PAGE_HEIGHT = A4[0]
const MARGIN = 15

const MIN_ROW_HEIGHT = 15

const FONT_SIZE_HEADER = 7
const FONT_SIZE_SUBHEADER = 7
const FONT_SIZE_DATA = 7
const PADDING = 5
const HEADER_HEIGHT = 60

async function initializePDFDocument(): Promise<{
  alefRegularBytes: Buffer
  alefBoldBytes: Buffer
  logoBytes: Buffer
  dejavuSansBytes: Buffer
}> {
  const cwd = process.cwd() as unknown as string
  logger.warn(`Current working directory: ${cwd}`)

  const regularFontPath = path.join('public', 'fonts', 'ariel.ttf')
  const boldFontPath = path.join('public', 'fonts', 'ariel-bold.ttf')
  const dejavuSansPath = path.join('public', 'fonts', 'dejavu-sans.book.ttf')
  const logoPath = path.join('public', 'emda_logo.png')


  if (!fs.existsSync(regularFontPath) || !fs.existsSync(boldFontPath) || !fs.existsSync(logoPath) || !fs.existsSync(dejavuSansPath)) {
    throw new Error(
      'Could not find font files or logo in public directory. Please check the paths and file permissions.',
    )
  }

  let alefRegularBytes, alefBoldBytes, logoBytes, dejavuSansBytes

  try {
    alefRegularBytes = fs.readFileSync(regularFontPath)
    alefBoldBytes = fs.readFileSync(boldFontPath)
    dejavuSansBytes = fs.readFileSync(dejavuSansPath)
    logoBytes = fs.readFileSync(logoPath)
    logger.warn('Successfully loaded assets from public directory')
  } catch (error: any) {
    logger.warn('Error reading files from public directory:', error)
    throw new Error('Failed to read font files or logo from public directory')
  }

  return { alefRegularBytes, alefBoldBytes, logoBytes, dejavuSansBytes }
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

  if (/^[0-9.,/%-]+$/.test(text) || text === '✓' || text === '') {
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
  if (/^[0-9.,/%-]+$/.test(text) || text === '✓' || text === '') {
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
  const dateRangeText = `${formatNormalDate(dateRange.startDate)} - ${formatNormalDate(dateRange.endDate)}`

  const dateRangeWidth = doc.getTextWidth(dateRangeText)
  doc.text(dateRangeText, (PAGE_WIDTH - dateRangeWidth) / 2, MARGIN + 29)
}

export async function generateParticipationsPDF(
  data: any[],
  options: ExportOptions,
): Promise<Uint8Array> {
  try {
    const { alefRegularBytes, alefBoldBytes, logoBytes, dejavuSansBytes } = await initializePDFDocument()

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    })

    const alefRegularBase64 = alefRegularBytes.toString('base64')
    const alefBoldBase64 = alefBoldBytes.toString('base64')
    const dejavuSansBase64 = dejavuSansBytes.toString('base64')
    const logoBase64 = logoBytes.toString('base64')

    // הוספת הפונטים ל-PDF
    doc.addFileToVFS('Ariel.ttf', alefRegularBase64)
    doc.addFont('Ariel.ttf', 'Ariel', 'normal')
    doc.addFileToVFS('Ariel-bold.ttf', alefBoldBase64)
    doc.addFont('Ariel-bold.ttf', 'Ariel', 'bold')
    doc.addFileToVFS('DejaVuSans.ttf', dejavuSansBase64)
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
    doc.setFont('Ariel', 'normal')

    const imageProps = doc.getImageProperties(logoBase64)
    const logoWidth = 80
    const logoHeight = (imageProps.height / imageProps.width) * logoWidth

    if (data.length === 0) {
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

    const columnStyles: { [key: string]: Partial<import('jspdf-autotable').Styles> } = {
      '0': { halign: 'center', cellWidth: 30 },
      '1': { halign: 'center', cellWidth: 30 },
      '2': { halign: 'center', cellWidth: 30 },
      '3': { halign: 'center', cellWidth: 40 },
      '4': { halign: 'center', cellWidth: 35 },
      '5': { halign: 'center', cellWidth: 35 },
      '6': { halign: 'center', cellWidth: 50 },
      '7': { halign: 'center', cellWidth: 50 },
      '8': { halign: 'center', cellWidth: 50 },
      '9': { halign: 'center', cellWidth: 45 }, // סוג אסיפה
      '10': { halign: 'center', cellWidth: 48 }, // מועד אסיפה
      '11': { halign: 'center', cellWidth: 43 }, // שווי החזקה
      '12': { halign: 'center', cellWidth: 35 }, // החזקה באחוזים
      '13': { halign: 'center', cellWidth: 35 }, // שווי שוק
      '14': { halign: 'center', cellWidth: 45 }, // שם נייר
      '15': { halign: 'center', cellWidth: 75 }, // שם חברה
      '16': { halign: 'center', cellWidth: 70 }, // תשם תאגיד
      '17': { halign: 'center', cellWidth: 45 }, // מספר נייר
      '18': { halign: 'center', cellWidth: 20 }, // מספר סעיף
    }

    // יצירת הכותרות - שורה ראשונה עם המיזוג
    const headerRow1 = [
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.PERSONAL_INTEREST, doc, 35), rowSpan: 2 },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.RELATED_PARTY, doc, 35), rowSpan: 2 },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.CONFLICT_OF_INTEREST, doc, 45),
        rowSpan: 2,
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.POLICY_COMPLIANCE, doc, 70),
        rowSpan: 2,
      },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.SPECIAL_MAJORITY, doc, 45), rowSpan: 2 },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.REGULAR_MAJORITY, doc, 45), rowSpan: 2 },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.MEETING_RESULTS, doc, 55), rowSpan: 2 },
      { content: prepareTextWithLineBreaks(SHARED_COLUMNS.VOTE, doc, 50), rowSpan: 2 },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.ADVISOR_RECOMMENDATION, doc, 50),
        rowSpan: 2,
      },
      {
        content: prepareText('נושא'),
        colSpan: 9, // מיזוג8 עמודות - עמודות 9-16
        halign: 'center',
        styles: {
          fontSize: FONT_SIZE_HEADER,
          cellPadding: { top: PADDING + 13 },
        },
      },
      { content: '', rowSpan: 2 }, // עמודה 16 - מספר סעיף
    ]

    const headerRow2 = [
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[0], doc, 70),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // מספר מניה
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[1], doc, 70),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, //  שם תאגיד
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[2], doc, 70),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, //  שם חברה
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[3], doc, 60),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שם מניה
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[4], doc, 60),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שווי שוק
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[5], doc, 50),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // אחוז החזקה
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[6], doc, 80),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // שווי החזקה
      {
        content: prepareTextWithLineBreaks(COMPANY_SUB_HEADERS[7], doc, 90),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // תאריך ישיבה
      {
        content: prepareText(COMPANY_SUB_HEADERS[8]),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      }, // סוג ישיבה
    ]

    const head = [headerRow1, headerRow2.reverse()]

    const body: any[] = []

    for (const meeting of data) {
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
        meeting.currentCompany.name || 'מוק שם החברה',
        meeting.corporateName || '',
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
        // עמודות 9-16 עם נתוני החברה
        {
          content:
            companyValues[0].length > 10
              ? prepareTextWithLineBreaks(companyValues[0], doc, 30)
              : prepareText(companyValues[0]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareText(companyValues[1]),
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
          content:
            companyValues[5].length > 30
              ? prepareTextWithLineBreaks(companyValues[5], doc, 30)
              : prepareText(companyValues[5]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareTextWithLineBreaks(companyValues[6], doc, 150),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareTextWithLineBreaks(companyValues[7], doc, 150),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content:
            companyValues[7].length > 10
              ? prepareTextWithLineBreaks(companyValues[8], doc, 30)
              : prepareText(companyValues[8]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        // עמודה 16 ריקה
        { content: '', styles: { fillColor: companyHeaderBgColor } },
      ]
      body.push(companyRow)

      // הוספת שורות הסעיפים
      meeting.agendas.forEach((agenda: any, i: number) => {
        const rowBg = i % 2 === 0 ? [245, 250, 255] : [230, 237, 255]
        const defaultTextColor = [51, 51, 51]

        // Language detection for agenda text
        const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
        const alignment = isEnglish ? 'left' : 'right'

        // Prepare agenda text with line breaks and reverse only if not English
        const preparedAgendaText = isEnglish
          ? (agenda.text || '').replace(/[\r\n]+/g, ' ').trim()
          : prepareTextWithLineBreaks(agenda.text || '', doc, 950) // Reverse for non-English

        // Organize agenda data for columns 0-8
        const agendaData = [
          booleanToIcon(agenda.personalInterest), // עמודה 0
          booleanToIcon(agenda.relatedParty), // עמודה 1
          booleanToIcon(agenda.conflictOfInterest), // עמודה 2
          booleanToIcon(agenda.policyCompliance), // עמודה 3
          agenda.privilegedMajority && agenda.vPercentSpecial ? `${formatNumberWithLocale(agenda.vPercentSpecial)}%` : '', // עמודה 4
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
            let fontToUse = 'Ariel'
            let fontStyle = 'normal'
            
            if (content === '✓') {
              thisTextColor = [0, 153, 0]
              fontToUse = 'DejaVuSans'
            }
            
            return {
              content: prepareText(content),
              styles: { 
                fillColor: rowBg, 
                textColor: thisTextColor,
                font: fontToUse,
                fontStyle: fontStyle
              },
            }
          }),
          // עמודה 9 - טקסט הסעיף עם מיזוג 7 עמודות
          {
            content: preparedAgendaText,
            colSpan: 9, // מיזוג עמודות 9-16
            styles: {
              fillColor: rowBg,
              textColor: defaultTextColor,
              halign: alignment,
              valign: 'top',
            },
          },
          // עמודה 17 - מספר הסעיף
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
          colSpan: 19, // מיזוג כל העמודות
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
        fillColor: [245, 245, 245],
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