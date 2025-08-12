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
    y: titleY - 25,
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
  const footerText = `${pageNumber}/${totalPages}`
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

/**
 * פונקציה שמקבלת מחרוזת טקסט ארוכה ומחלקת אותה למערך של שורות,
 * כך שאף שורה לא תחרוג מהרוחב המקסימלי הנתון.
 * @param text הטקסט המלא לעיטוף.
 * @param font אובייקט הפונט של pdf-lib.
 * @param fontSize גודל הפונט.
 * @param maxWidth הרוחב המקסימלי המותר לשורה בפיקסלים.
 * @returns מערך של מחרוזות, כאשר כל מחרוזת היא שורה.
 */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
    return [text];
  }

  for (const word of words) {
    // בודק אם השורה הנוכחית בתוספת המילה החדשה חורגת מהרוחב
    const testLine = currentLine === '' ? word : `${currentLine} ${word}`;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      // אם השורה חורגת, דחוף את השורה הנוכחית למערך והתחל שורה חדשה עם המילה הנוכחית
      lines.push(currentLine);
      currentLine = word;
    }
  }
  // הוספת השורה האחרונה שנותרה
  lines.push(currentLine);

  return lines.filter(line => line.trim() !== '');
}

async function generateMeetingTable(
  page: PDFPage,
  meetingData: GroupedMeetingData,
  startY: number,
  fonts: { regular: any; bold: any }
): Promise<number> {
  let currentY = startY;

  // ערכת צבעים וקבועים
  const headerBgColor = rgb(229 / 255, 224 / 255, 236 / 255);
  const companyInfoHeight = 35;
  const FONT_SIZE_HEADER = 7;
  const FONT_SIZE_DATA = 7;
  const LINE_HEIGHT_HEADER = 9; // גובה שורה לכותרת (גודל פונט + מרווח)

  // --- חלק פרטי החברה (ללא שינוי) ---
  page.drawRectangle({
    x: MARGIN,
    y: currentY - companyInfoHeight + 5,
    width: CONTENT_WIDTH,
    height: companyInfoHeight,
    color: headerBgColor
  });

  const companyInfoY = currentY - 10;
  const companyHeaders = ['שם נייר', 'מספר נייר', 'סוג האסיפה', 'מועד האסיפה', 'שווי אחזקה (במיליוני ₪)', 'אחזקה באחוזים', 'שווי שוק (במיליוני ₪)'];
  const companyValues = [
    meetingData.stockName || '',
    meetingData.stockNumber || '',
    meetingData.meetingType || '',
    meetingData.meetingDate || '',
    meetingData.holdingValueInMillions?.toString() || '',
    `${meetingData.percentageHolding || 0}%`,
    meetingData.marketValue || ''
  ];

  let headerX = PAGE_WIDTH - MARGIN - 20;
  companyHeaders.forEach((header, i) => {
    const headerWidth = fonts.bold.widthOfTextAtSize(header, 8);
    page.drawText(header, {
      x: headerX - headerWidth, y: companyInfoY, size: 8, font: fonts.bold, color: rgb(0.1, 0.1, 0.1)
    });
    const value = companyValues[i]
    const valueWidth = fonts.regular.widthOfTextAtSize(value, 8);
    page.drawText(value, {
      x: headerX - valueWidth, y: companyInfoY - 12, size: 8, font: fonts.regular, color: rgb(0.2, 0.2, 0.2)
    })
    headerX -= 110
  })

  currentY -= companyInfoHeight - 3

  const headers = [
    'נושא',
    'המלצת גורם מייעץ',
    'הצבעה',
    'תוצאות האסיפה',
    'רוב רגיל (%)',
    'רוב מיוחד (%)',
    'בהתאם למדיניות דירקטוריון ו/או וועדת השקעות',
    'ניגוד עניינים',
    'צד קשר',
    'עניין אישי'
  ];

  const columnWidths = [190, 60, 50, 60, 50, 50, 90, 50, 50, 50]; // עודכן רוחב עמודות כדי לפנות מקום לכותרות המתפרסות
  const rowHeightData = 20; // גובה שורה עבור שורות הנתונים

  const headerTextColor = rgb(0.1, 0.1, 0.1);
  const rowOddBgColor = rgb(245 / 255, 242 / 255, 250 / 255); // צבע הרקע לשורות אי-זוגיות (כמו שהיה)
  const rowEvenBgColor = rgb(253 / 255, 252 / 255, 254 / 255);
  const rowTextColor = rgb(0.2, 0.2, 0.2);

  // 1. עטוף את כל הכותרות לשורות מרובות לפי רוחב העמודה
  const wrappedHeaders = headers.map((header, i) =>
    wrapText(header, fonts.bold, FONT_SIZE_HEADER, columnWidths[i] - 4) // -4 פיקסלים למרווח פנימי
  );

  // 2. חשב את גובה שורת הכותרת הדינאמי על בסיס הכותרת הארוכה ביותר
  const maxLinesInHeader = Math.max(...wrappedHeaders.map(lines => lines.length));
  const headerRowHeight = maxLinesInHeader * LINE_HEIGHT_HEADER + 8; // +8 פיקסלים למרווח אנכי

  // 3. צייר את רקע הכותרת עם הגובה הדינאמי
  page.drawRectangle({
    x: MARGIN,
    y: currentY - headerRowHeight,
    width: CONTENT_WIDTH,
    height: headerRowHeight,
    color: headerBgColor
  });

  // 4. צייר את הכותרות הרב-שורתיות
  let currentX = PAGE_WIDTH - MARGIN;
  wrappedHeaders.forEach((lines, i) => {
    const colWidth = columnWidths[i];
    const startXForCol = currentX - colWidth;

    // חישוב נקודת התחלה אנכית (Y) למרכוז גוש הטקסט כולו
    const blockHeight = lines.length * LINE_HEIGHT_HEADER;
    let lineY = currentY - (headerRowHeight - blockHeight) / 2 - FONT_SIZE_HEADER;

    // עבור על כל שורה בגוש וצייר אותה
    lines.forEach(line => {
      const textWidth = fonts.bold.widthOfTextAtSize(line, FONT_SIZE_HEADER);
      // מרכז את השורה אופקית בתוך העמודה
      const textX = startXForCol + (colWidth - textWidth) / 2;

      page.drawText(line, {
        x: textX,
        y: lineY,
        size: FONT_SIZE_HEADER,
        font: fonts.bold,
        color: headerTextColor,
        lineHeight: LINE_HEIGHT_HEADER
      });
      lineY -= LINE_HEIGHT_HEADER; // קדם את ה-Y לשורה הבאה
    });

    currentX -= colWidth;
  });

  currentY -= headerRowHeight; // קדם את Y הראשי בסוף ציור הכותרת

  // --- שורות הנתונים (לוגיקה דומה לקודם, עם התאמות קלות) ---
  meetingData.agendas.forEach((agenda, idx) => {
    page.drawRectangle({
      x: MARGIN,
      y: currentY - rowHeightData,
      width: CONTENT_WIDTH,
      height: rowHeightData,
      color: idx % 2 == 0 ? rowOddBgColor : rowEvenBgColor
    })

    const rowData = [
      agenda.text || '',
      agenda.recommendation?.votingRecommendation || '',
      agenda.vote || '',
      agenda.result || agenda.meetingResults || '',
      agenda.regularMajority || '',
      agenda.specialMajority || '',
      agenda.boardPolicy || '',
      agenda.conflictOfInterest || '',
      agenda.relatedParty || '',
      agenda.personalInterest || ''
    ];

    let x = PAGE_WIDTH - MARGIN;
    rowData.forEach((cell, i) => {
      const colWidth = columnWidths[i];
      const maxLength = i === 0 ? 35 : (i === 6 ? 15 : 10); // התאמת אורך מקסימלי
      const textToDraw = String(cell).substring(0, maxLength);
      const textWidth = fonts.regular.widthOfTextAtSize(textToDraw, FONT_SIZE_DATA);
      const textX = x - colWidth + (colWidth - textWidth) / 2;

      page.drawText(textToDraw, {
        x: textX,
        y: currentY - (rowHeightData / 2) - 2,
        size: FONT_SIZE_DATA,
        font: fonts.regular,
        color: rowTextColor
      });
      x -= colWidth;
    });

    currentY -= rowHeightData;
  });

  return currentY;
}