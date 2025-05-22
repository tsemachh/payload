import { error } from 'console'
import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type CollectionAfterChangeHook,
} from 'payload'

const parseResearchFilename = (
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
  const nameWithoutDate = nameWithoutExtension.replace(/\d{2}\.\d{2}\.\d{4}$/, '').trim()
  console.log('----nameWithoutExtension', nameWithoutExtension)
  console.log('----nameWithoutDate', nameWithoutDate)

  const match = nameWithoutDate.match(/^(.+?)\s*\(([^)]+)\)$/)
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

export const validateResearchDocsInMeetings: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  const type = data?.type
  const docIDs = data?.researchDocuments
  console.log('----docIDs', docIDs)

  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
    return data
  }
  console.log('----type', type)

  const validationErrors: { message: string; path: string }[] = []

  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    validationErrors.push({
      message: 'לפגישות מסוג "אג"ח" או "אג"ח כהונת נאמן" ניתן לצרף מסמך מחקר אחד בלבד.',
      path: 'researchDocuments',
    })
  }

  if (validationErrors.length > 0) {
    throw new ValidationError({ errors: validationErrors })
  }

  return data
}

export const beforeValidaCompaniesFromFilename: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  const filename = data?.file?.filename || data?.filename
  if (!filename) return data
  if (data?.companies) return data
  const validationErrors: { message: string; path: string }[] = []

  const parsed = parseResearchFilename(filename)
  console.log('----parsed', parsed)

  if (!parsed.isValid) {
    console.log('----parsed', parsed.isValid, parsed.error)
    validationErrors.push({
      message: `${parsed.error}`,
      path: 'companies',
    })
  }

  if (parsed.isGeneric) {
    data.companies = []
  } else {
    if (!parsed.isGeneric && parsed.companyName) {
      const companies = await req.payload.find({
        collection: 'companies',
        where: { name: { like: parsed.companyName } },
      })
      console.log('-----companies', companies)

      if (companies) {
        const foundCompanies = companies.docs
        data.companies = foundCompanies.map((company) => company.id)
      } else {
        validationErrors.push({
          message: `שם החברה אינו תקין`,
          path: 'companies',
        })
      }
    }
    if (validationErrors.length > 0) {
      throw new ValidationError({ errors: validationErrors })
    }
    return data
  }
}

export const afterChangeDeleteResearchDocs: CollectionAfterChangeHook = async ({
  doc,
  req,
  previousDoc,
}) => {
  const prev = previousDoc?.researchDocuments || []
  const curr = doc?.researchDocuments || []
  const removed = prev.filter((id: string) => !curr.includes(id))
  console.log('-------------- prev', prev)
  console.log('-------------- curr', curr)
  console.log('-------------- removed', removed)

  await Promise.all(
    removed.map(async (id: any) => {
      await req.payload.delete({
        collection: 'research-documents',
        id: id,
      })
    }),
  )
}
