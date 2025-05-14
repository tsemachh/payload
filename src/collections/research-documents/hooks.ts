import type { CollectionBeforeValidateHook } from 'payload'

const parseResearchFilename = (
  fileName: string
): { stockName?: string; companyName?: string; isGeneric: boolean; isValid: boolean; error?: string } => {
  if (!/\.(pdf|docx)$/i.test(fileName)) {
    return { isGeneric: false, isValid: false, error: 'Invalid file extension' }
  }

  const nameWithoutExtension = fileName.replace(/\.(pdf|docx)$/i, '').trim()
  const nameWithoutDate = nameWithoutExtension.replace(/\d{2}\.\d{2}\.\d{4}$/, '').trim()

  const match = nameWithoutDate.match(/^(.+?)\s*\(([^)]+)\)$/)
  if (!match) {
    return { isGeneric: false, isValid: false, error: 'Missing (company) part' }
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

// 💥 הפונקציה הראשית שיושבת על beforeValidate של הקולקשן meetings
export const validateResearchDocsHook: CollectionBeforeValidateHook = async ({ data, req }) => {
  console.log('****** נכנס ל-hook של אסיפות validateResearchDocsHook ******')

  const type = data?.type
  const docIDs = data?.['research-documents']

  console.log('****** סוג האסיפה:', type)
  console.log('****** מזהי מסמכי מחקר:', docIDs)

  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
    console.log('****** אין מסמכי מחקר - יוצא מה-hook')
    return data
  }

  const researchDocs = await req.payload.find({
    collection: 'research-documents',
    where: {
      id: {
        in: docIDs,
      },
    },
  })

  const docs = researchDocs.docs || []
  console.log(`****** נמצאו ${docs.length} מסמכים`)

  for (const doc of docs) {
    console.log(`****** בודק קובץ: ${doc.filename}`)

    if (!doc.filename) continue

    const parsed = parseResearchFilename(doc.filename)
    console.log('****** תוצאה מפורקת:', parsed)

    if (!parsed.isValid) {
      throw new Error(parsed.error || 'Invalid research document filename format')
    }

    if (!parsed.isGeneric && parsed.companyName) {
      const companyResult = await req.payload.find({
        collection: 'companies',
        where: { name: { like: parsed.companyName } },
      })

      if (companyResult.docs.length === 0) {
        throw new Error(`לא נמצאה חברה בשם: ${parsed.companyName}`)
      }

      console.log('****** חברה קיימת במסד:', parsed.companyName)
    }
  }

  // הגבלה על מסמך יחיד עבור סוגים מסוימים
  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    throw new Error('לא ניתן להעלות יותר ממסמך מחקר אחד לאסיפת אג"ח או אג"ח כהונת נאמן')
  }

  return data
}
