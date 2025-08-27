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

function prepareText(text: string): string {
  text = fixBiDiText(text)
  if (/^[0-9.,/%-]+$/.test(text) || text === 'V' || text === 'X' || text === '') {
    return text
  }
  // Reverse for RTL display in jsPDF
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
      40,
      40,
      40,
      60,
      40,
      45,
      45,
      45,
      45,
      subWidth,
      subWidth,
      subWidth,
      subWidth,
      subWidth,
      subWidth,
      subWidth,
      15,
    ]

    const columnStyles = {
      0: { halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'right' },
      10: { halign: 'center' },
      11: { halign: 'center' },
      12: { halign: 'center' },
      13: { halign: 'center' },
      14: { halign: 'center' },
      15: { halign: 'center' },
      16: { halign: 'center' },
    }

    const head = [
      [
        { content: prepareText(SHARED_COLUMNS.PERSONAL_INTEREST), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.RELATED_PARTY), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.CONFLICT_OF_INTEREST), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.POLICY_COMPLIANCE), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.SPECIAL_MAJORITY), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.REGULAR_MAJORITY), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.MEETING_RESULTS), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.VOTE), rowSpan: 2 },
        { content: prepareText(SHARED_COLUMNS.ADVISOR_RECOMMENDATION), rowSpan: 2 },
        {
          content: prepareText('נושא'),
          colSpan: 7,
          halign: 'center',
          styles: {
            fontSize: FONT_SIZE_HEADER,
            cellPadding: { top: PADDING + 13 },
          },
        },
        { content: '', rowSpan: 2 },
      ],
      COMPANY_SUB_HEADERS.map((sub) => ({
        content: prepareText(sub),
        halign: 'center',
        styles: { fontSize: FONT_SIZE_SUBHEADER },
      })),
    ]

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

      const companyValues = [
        meeting.stockNumber || '',
        meeting.stockName || '',
        formattedMarketValue,
        formattedPercentageHolding,
        formattedHoldingValueInMillions,
        formattedDate,
        meeting.meetingType || '',
      ]
        .reverse()
        .map(prepareText)

      const companyRow = [
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
        {
          content: companyValues[0],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[1],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[2],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[3],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[4],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[5],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        {
          content: companyValues[6],
          styles: { fillColor: companyHeaderBgColor, halign: 'center', textColor },
        },
        { content: '', styles: { fillColor: companyHeaderBgColor } },
      ]
      body.push(companyRow)

      meeting.agendas.forEach((agenda: any, i: number) => {
        const rowBg = i % 2 === 0 ? [245, 250, 255] : [231, 240, 255]
        const defaultTextColor = [51, 51, 51]

        const rowData = [
          booleanToIcon(agenda.personalInterest),
          booleanToIcon(agenda.relatedParty),
          booleanToIcon(agenda.conflictOfInterest),
          booleanToIcon(agenda.policyCompliance),
          agenda.privilegedMajority && agenda.vPercentSpecial ? `${agenda.vPercentSpecial}` : '',
          booleanToIcon(!agenda.privilegedMajority),
          agenda.result
            ? resultMapping[agenda.result] || agenda.result
            : agenda.meetingResults || '',
          agenda.vote || '',
          agenda.recommendation?.votingRecommendation || '',
          agenda.text || '',
          (i + 1).toString(),
        ]

        const row = rowData.map((content, index) => {
          let thisTextColor = defaultTextColor
          if (content === 'V') {
            thisTextColor = [0, 153, 0]
          } else if (content === 'X') {
            thisTextColor = [204, 0, 0]
          }
          const cell: any = {
            content: prepareText(content),
            styles: { fillColor: rowBg, textColor: thisTextColor },
          }
          // Apply colSpan and halign for agenda text cell (index 9)
          if (index === 9) {
            cell.colSpan = 7
            cell.styles.halign = 'right'
          }
          return cell
        })

        body.push(row)
      })

      body.push([
        {
          content: '',
          colSpan: widths.length,
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
        // textDirection: 'rtl',
      },
      // columnStyles,
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
