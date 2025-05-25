export const parseResearchFilename = (
  fileName: string,
): {
  stockName?: string
  companyName?: string
  isGeneric: boolean
  isValid: boolean
  error?: string
} => {
  if (!/\.(pdf|docx)$/i.test(fileName)) {
    return {
      isGeneric: false,
      isValid: false,
      error: 'סיומת הקובץ אינה נתמכת. יש להעלות קבצים מסוג PDF או DOCX בלבד.',
    }
  }

  const nameWithoutExtension = fileName.replace(/\.(pdf|docx)$/i, '').trim()

  // מתעלם מכל מה שאחרי הסוגריים
  const match = nameWithoutExtension.match(/^(.+?)\s*\(([^)]+)\)/)

  if (!match) {
    return {
      isGeneric: false,
      isValid: false,
      error: 'שם הקובץ אינו בפורמט הנדרש. יש לכלול שם נייר ערך ושם חברה בתוך סוגריים.',
    }
  }

  const stockName = match[1].trim()
  const companyName = match[2].trim()

  return {
    stockName,
    companyName,
    isGeneric: companyName === 'עמדה',
    isValid: true,
  }
}
