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
const TABLE_WIDTH = 811 // Sum of column widths from columnStyles

const MIN_ROW_HEIGHT = 15
const VOTE_REASON_ROW_HEIGHT = 10

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

  if (
    !fs.existsSync(regularFontPath) ||
    !fs.existsSync(boldFontPath) ||
    !fs.existsSync(logoPath) ||
    !fs.existsSync(dejavuSansPath)
  ) {
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
    const { alefRegularBytes, alefBoldBytes, logoBytes, dejavuSansBytes } =
      await initializePDFDocument()

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

    // Determine if any meeting has displayVotingRecommendation: true
    const showAdvisorColumn = data.some((meeting) => meeting.displayVotingRecommendation === true)
    // Define column styles based on whether the advisor column is included
    const columnStyles: { [key: string]: Partial<import('jspdf-autotable').Styles> } =
      showAdvisorColumn
        ? {
            '0': { halign: 'center', cellWidth: 30 }, // Personal Interest
            '1': { halign: 'center', cellWidth: 30 }, // Related Party
            '2': { halign: 'center', cellWidth: 30 }, // Conflict of Interest
            '3': { halign: 'center', cellWidth: 40 }, // Policy Compliance
            '4': { halign: 'center', cellWidth: 35 }, // Special Majority
            '5': { halign: 'center', cellWidth: 35 }, // Regular Majority
            '6': { halign: 'center', cellWidth: 50 }, // Meeting Results
            '7': { halign: 'center', cellWidth: 50 }, // Vote
            '8': { halign: 'center', cellWidth: 50 }, // ADVISOR_RECOMMENDATION
            '9': { halign: 'center', cellWidth: 45 }, // Meeting Type (סוג אסיפה)
            '10': { halign: 'center', cellWidth: 48 }, // Meeting Date (מועד אסיפה)
            '11': { halign: 'center', cellWidth: 43 }, // Holding Value (שווי החזקה)
            '12': { halign: 'center', cellWidth: 35 }, // Percentage Holding (החזקה %)
            '13': { halign: 'center', cellWidth: 35 }, // Market Value (שווי שוק)
            '14': { halign: 'center', cellWidth: 75 }, // Company Name (שם חברה)
            '15': { halign: 'center', cellWidth: 45 }, // Stock Name (שם נייר)
            '16': { halign: 'center', cellWidth: 70 }, // Corporate Name (שם התאגיד)
            '17': { halign: 'center', cellWidth: 45 }, // Stock Number (מספר נייר)
            '18': { halign: 'center', cellWidth: 20 }, // Agenda Number
          }
        : {
            '0': { halign: 'center', cellWidth: 32 }, // Personal Interest (+6)
            '1': { halign: 'center', cellWidth: 32 }, // Related Party (+6)
            '2': { halign: 'center', cellWidth: 32 }, // Conflict of Interest (+6)
            '3': { halign: 'center', cellWidth: 44 }, // Policy Compliance (+8)
            '4': { halign: 'center', cellWidth: 37 }, // Special Majority (+6)
            '5': { halign: 'center', cellWidth: 37 }, // Regular Majority (+6)
            '6': { halign: 'center', cellWidth: 52 }, // Meeting Results (+6)
            '7': { halign: 'center', cellWidth: 52 }, // Vote (+6)
            '8': { halign: 'center', cellWidth: 45 }, // Meeting Type (סוג אסיפה)
            '9': { halign: 'center', cellWidth: 48 }, // Meeting Date (מועד אסיפה)
            '10': { halign: 'center', cellWidth: 43 }, // Holding Value (שווי החזקה)
            '11': { halign: 'center', cellWidth: 35 }, // Percentage Holding (החזקה %)
            '12': { halign: 'center', cellWidth: 35 }, // Market Value (שווי שוק)
            '13': { halign: 'center', cellWidth: 75 }, // Company Name (שם חברה)
            '14': { halign: 'center', cellWidth: 45 }, // Stock Name (שם נייר)
            '15': { halign: 'center', cellWidth: 70 }, // Corporate Name (שם התאגיד)
            '16': { halign: 'center', cellWidth: 45 }, // Stock Number (מספר נייר)
            '17': { halign: 'center', cellWidth: 20 }, // Agenda Number
          }

    // Define header rows based on showAdvisorColumn
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
      ...(showAdvisorColumn
        ? [
            {
              content: prepareTextWithLineBreaks(SHARED_COLUMNS.ADVISOR_RECOMMENDATION, doc, 50),
              rowSpan: 2,
            },
          ]
        : []),
      {
        content: '', //  הכותרת "נושא" - עמודה ריקה
        colSpan: 9, 
        halign: 'center',
        styles: {
          fontSize: FONT_SIZE_HEADER,
          cellPadding: { top: PADDING + 13 },
        },
      },
      { content: '', rowSpan: 2 }, // עמודה 18 - מספר סעיף
    ]

    const headerRow2 = [
      {
        content: prepareText(SHARED_COLUMNS.MEETING_TYPE), // סוג אסיפה
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.MEETING_DATE, doc, 90), // מועד אסיפה
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.HOLDING_VALUE, doc, 80), // שווי החזקה
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.PERCENTAGE_HOLDING, doc, 50), // החזקה %
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.MARKET_VALUE, doc, 60), // שווי שוק
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.COMPANY_NAME, doc, 70), // שם חברה
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.STOCK_NAME, doc, 60), // שם נייר
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.CORPORATE_NAME, doc, 70), // שם התאגיד
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
      {
        content: prepareTextWithLineBreaks(SHARED_COLUMNS.STOCK_NUMBER, doc, 70), // מספר נייר
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      },
    ]

    const head = [headerRow1, headerRow2]

    const body: any[] = []

    for (const meeting of data) {
      const companyHeaderBgColor = [210, 228, 255]
      const textColor = [51, 51, 51]
      // Initialize vote reason counter and array for each meeting
      const voteReasons: { index: number; reason: string }[] = []
      let voteReasonCounter = 1

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

      // Organize company data for columns 9-17 (or 9-16 if no advisor column)
      // הסדר החדש: סוג אסיפה, מועד אסיפה, שווי החזקה, החזקה %, שווי שוק, שם חברה, שם נייר, שם התאגיד, מספר נייר
      const companyValues = [
        meeting.meetingType || '', // סוג אסיפה (Meeting Type)
        formattedDate, // מועד אסיפה (Meeting Date)
        formattedHoldingValueInMillions, // שווי החזקה (Holding Value)
        formattedPercentageHolding, // החזקה % (Percentage Holding)
        formattedMarketValue, // שווי שוק (Market Value)
        meeting.currentCompany.name || 'מוק שם החברה', // שם חברה (Company Name)
        meeting.stockName || '', // שם נייר (Stock Name)
        meeting.corporateName || '', // שם התאגיד (Corporate Name)  
        meeting.stockNumber || '', // מספר נייר (Stock Number)
      ]

      // Create company header row with colored background
      const companyRow = [
        // Columns 0-7 (or 0-6) empty with colored background
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        ...(showAdvisorColumn
          ? [{ content: '', styles: { fillColor: companyHeaderBgColor } }]
          : []),
        // Company data columns
        {
          content:
            companyValues[0].length > 10
              ? prepareTextWithLineBreaks(companyValues[0], doc, 70)
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
              ? prepareTextWithLineBreaks(companyValues[5], doc, 80)
              : prepareText(companyValues[5]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareTextWithLineBreaks(companyValues[6], doc, 130),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: prepareTextWithLineBreaks(companyValues[7], doc, 130),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content:
            companyValues[8].length > 10
              ? prepareTextWithLineBreaks(companyValues[8], doc, 30)
              : prepareText(companyValues[8]),
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        // Agenda Number column (empty)
        { content: '', styles: { fillColor: companyHeaderBgColor } },
      ]
      body.push(companyRow)

      // Add agenda rows
      meeting.agendas.forEach((agenda: any, i: number) => {
        const rowBg = i % 2 === 0 ? [245, 250, 255] : [230, 237, 255]
        const isRemoved = agenda.isRemoved === true
        const defaultTextColor = isRemoved ? [128, 128, 128] : [51, 51, 51]

        // Language detection for agenda text
        const isEnglish = /^[A-Za-z]/.test(agenda.text?.trim?.() || '')
        const alignment = isEnglish ? 'left' : 'right'

        // Store the ORIGINAL text before any processing
        const originalAgendaText = agenda.text || ''

        // Prepare agenda text for display
        const baseAgendaText = agenda.text || ''
        const preparedAgendaText = isEnglish
          ? baseAgendaText.replace(/[\r\n]+/g, ' ').trim()
          : prepareTextWithLineBreaks(baseAgendaText, doc, 950)

        // For removed items, add the notice on a separate line
        let fullTextForDisplay = preparedAgendaText
        if (isRemoved) {
          const removedNotice = isEnglish
            ? '(Removed from agenda)'
            : prepareText('(הוסר מסדר היום)')
          fullTextForDisplay = preparedAgendaText + '\n' + removedNotice
        }

        // Store the prepared text for strikethrough calculation
        const preparedAgendaTextForStrikethrough = preparedAgendaText

        let voteContent = !isRemoved ? agenda.vote || '' : ''
        if (!isRemoved && agenda.voteReason && agenda.voteReason.trim() !== '') {
          voteContent = `${voteContent} ]${voteReasonCounter}[`
          voteReasons.push({ index: voteReasonCounter, reason: agenda.voteReason })
          voteReasonCounter++
        }

        // Organize agenda data for columns 0-7 (or 0-6 if no advisor column)
        // If removed, show empty strings for voting details
        const agendaData = isRemoved
          ? ['', '', '', '', '', '', '', '']
          : [
              booleanToIcon(agenda.personalInterest), // Column 0
              booleanToIcon(agenda.relatedParty), // Column 1
              booleanToIcon(agenda.conflictOfInterest), // Column 2
              booleanToIcon(agenda.policyCompliance), // Column 3
              agenda.privilegedMajority && agenda.percentResult
                ? `${formatNumberWithLocale(agenda.percentResult)}%`
                : booleanToIcon(agenda.privilegedMajority), // Column 4
              agenda.simpleMajority && agenda.percentResult
                ? `${formatNumberWithLocale(agenda.percentResult)}%`
                : booleanToIcon(agenda.simpleMajority), // Column 5
              agenda.result
                ? resultMapping[agenda.result] || agenda.result
                : agenda.meetingResults || '', // Column 6
              voteContent, // Column 7
            ]

        // Add advisor column if needed
        if (showAdvisorColumn) {
          agendaData.push(
            isRemoved
              ? ''
              : meeting.displayVotingRecommendation
                ? agenda.recommendation?.votingRecommendation || ''
                : '',
          )
        }

        const row = [
          ...agendaData.map((content) => {
            let thisTextColor = defaultTextColor
            let fontToUse = 'Ariel'
            if (content === '✓') {
              thisTextColor = isRemoved ? [128, 128, 128] : [0, 153, 0]
              fontToUse = 'DejaVuSans'
            }
            return {
              content: prepareText(content),
              styles: {
                fillColor: rowBg,
                textColor: thisTextColor,
                font: fontToUse,
                fontStyle: 'normal',
              },
            }
          }),
          {
            content: fullTextForDisplay,
            colSpan: showAdvisorColumn ? 9 : 10,
            styles: {
              fillColor: rowBg,
              textColor: defaultTextColor,
              halign: alignment,
              valign: 'top',
            },
            // Store metadata for custom strikethrough drawing
            __isRemoved: isRemoved,
            __isEnglish: isEnglish,
            __originalAgendaText: originalAgendaText,
            __preparedAgendaText: preparedAgendaTextForStrikethrough,
          },
          // Agenda Number column
          {
            content: prepareText('.' + (i + 1).toString()),
            styles: { fillColor: rowBg, textColor: defaultTextColor, halign: 'center' },
          },
        ]
        body.push(row)
      })

      // Add vote reason rows
      if (voteReasons.length > 0) {
        // Add title row
        const titleText = voteReasons.length === 1 ? 'נימוק הצבעה' : 'נימוקי הצבעה'
        body.push([
          {
            content: prepareText(titleText),
            colSpan: showAdvisorColumn ? 19 : 18,
            styles: {
              font: 'Ariel',
              fontStyle: 'bold',
              fontSize: FONT_SIZE_DATA + 1,
              cellPadding: PADDING,
              textColor: [51, 51, 51],
              halign: 'right',
              minCellHeight: VOTE_REASON_ROW_HEIGHT,
              fillColor: [255, 255, 255],
            },
          },
        ])

        voteReasons.forEach(({ index, reason }) => {
          const isEnglish = /^[A-Za-z]/.test(reason?.trim?.() || '')
          const reasonText = isEnglish
            ? `${reason} .${index} `
            : prepareTextWithLineBreaks(`${index}. ${reason} `, doc, TABLE_WIDTH + 900)
          body.push([
            {
              content: reasonText,
              colSpan: showAdvisorColumn ? 19 : 18, // Adjust colSpan
              styles: {
                font: 'Ariel',
                fontStyle: 'normal',
                fontSize: FONT_SIZE_DATA,
                cellPadding: PADDING,
                textColor: [51, 51, 51],
                halign: 'right',
                minCellHeight: VOTE_REASON_ROW_HEIGHT,
                fillColor: [255, 255, 255],
              },
            },
          ])
        })
      }

      // Add empty row for separation
      body.push([
        {
          content: '',
          colSpan: showAdvisorColumn ? 19 : 18, // Adjust colSpan
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
      didDrawCell: (data: any) => {
        // Check if this is an agenda text cell that needs custom strikethrough
        const cell = data.cell
        const cellData = cell.raw

        if (cellData && cellData.__isRemoved && cellData.__preparedAgendaText) {
          doc.setFont('Ariel', 'normal')
          doc.setFontSize(FONT_SIZE_DATA)
          doc.setDrawColor(128, 128, 128)
          doc.setLineWidth(0.7)

          const cellX = cell.x
          const cellY = cell.y
          const cellWidth = cell.width
          const padding = PADDING

          const isEnglish = cellData.__isEnglish

          // Use the PREPARED text (already processed) instead of original
          const preparedText = cellData.__preparedAgendaText

          // For English text, we need to split it again because it was joined into one line
          // For Hebrew text, it's already split with \n
          let displayedLines
          if (isEnglish) {
            // Get the column width to split properly - calculate total width of company columns
            let totalColWidth = 0
            if (showAdvisorColumn) {
              // Columns 9-17 for company data when advisor column is shown
              for (let i = 9; i <= 17; i++) {
                const w = columnStyles[i.toString()]?.cellWidth
                const num = typeof w === 'number' ? w : Number(w) || 0
                totalColWidth += num
              }
            } else {
              // Columns 8-16 for company data when no advisor column
              for (let i = 8; i <= 16; i++) {
                const w = columnStyles[i.toString()]?.cellWidth
                const num = typeof w === 'number' ? w : Number(w) || 0
                totalColWidth += num
              }
            }
            const maxWidth = totalColWidth - 2 * padding
            displayedLines = doc.splitTextToSize(preparedText, maxWidth)
          } else {
            // Hebrew text is already split with \n
            displayedLines = preparedText.split('\n')
          }

          // Calculate line height based on actual cell height and number of lines (+1 for removed notice)
          const totalLines = displayedLines.length + 1
          const lineHeight = (cell.height - 2 * padding) / totalLines

          // Draw strikethrough on each line
          for (let i = 0; i < displayedLines.length; i++) {
            const lineY = cellY + padding + (i + 0.5) * lineHeight
            const currentLine = displayedLines[i]

            if (!currentLine || currentLine.trim() === '') continue

            // Calculate the actual width of the text in this line
            const textWidth = doc.getTextWidth(currentLine)

            // Determine alignment and calculate start position
            let startX, endX

            if (isEnglish) {
              // Left-aligned text
              startX = cellX + padding
              endX = startX + textWidth
            } else {
              // Right-aligned text (Hebrew) - the text is already reversed in preparedText
              endX = cellX + cellWidth - padding
              startX = endX - textWidth
            }

            // Draw line only across the text width
            doc.line(startX, lineY, endX, lineY)
          }
        }
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
