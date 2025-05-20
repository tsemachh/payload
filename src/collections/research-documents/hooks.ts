import { ValidationError, type CollectionBeforeValidateHook ,type CollectionBeforeChangeHook} from 'payload'

const parseResearchFilename = (
  fileName: string
): { stockName?: string; companyName?: string; isGeneric: boolean; isValid: boolean; error?: string } => {
  if (!/\.(pdf|docx)$/i.test(fileName)) {
    return {
      isGeneric: false,
      isValid: false,
      error: 'סיומת הקובץ אינה נתמכת. יש להעלות קבצים מסוג PDF או DOCX בלבד.',
    }
  }

  const nameWithoutExtension = fileName.replace(/\.(pdf|docx)$/i, '').trim()
  const nameWithoutDate = nameWithoutExtension.replace(/\d{2}\.\d{2}\.\d{4}$/, '').trim()
  console.log("----nameWithoutExtension",nameWithoutExtension)
  console.log("----nameWithoutDate",nameWithoutDate)

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

export const validateResearchDocsHook: CollectionBeforeValidateHook = async ({ data, req }) => {
  const type = data?.type
  const docIDs = data?.['research-documents']

  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
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
  const validationErrors: { message: string; path: string }[] = []

  for (const doc of docs) {
    if (!doc.filename) continue

    const parsed = parseResearchFilename(doc.filename)

    if (!parsed.isValid) {
      validationErrors.push({
        message: `קובץ "${doc.filename}": ${parsed.error}`,
        path: 'research-documents',
      })
      continue
    }
//להוריד
    if (!parsed.isGeneric && parsed.companyName) {
      const companyResult = await req.payload.find({
        collection: 'companies',
        where: { name: { like: parsed.companyName } },
      })

      const foundCompanies = companyResult.docs

      if (!foundCompanies || foundCompanies.length === 0) {
        validationErrors.push({
          message: `קובץ "${doc.filename}": לא נמצאה חברה בשם "${parsed.companyName}".`,
          path: 'research-documents',
        })
        continue
      }

      try {
        await req.payload.update({
          collection: 'research-documents',
          id: doc.id,
          data: {
            companies: foundCompanies.map((company) => company.id),
          },
        })
      } catch (err) {
        validationErrors.push({
          message: `קובץ "${doc.filename}": אירעה שגיאה בעת ניסיון לשייך את החברה "${parsed.companyName}" למסמך.`,
          path: 'research-documents',
        })
      }
    }
  }

  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    validationErrors.push({
      message: 'לפגישות מסוג "אג"ח" או "אג"ח כהונת נאמן" ניתן לצרף מסמך מחקר אחד בלבד.',
      path: 'research-documents',
    })
  }

  if (validationErrors.length > 0) {
    throw new ValidationError({ errors: validationErrors })
  }

  return data
}

export const beforeChangeCompaniesFromFilename:CollectionBeforeChangeHook = async ({ data, req }) => {
  const filename = data.filename || '';
  const parsed = parseResearchFilename(filename);
  console.log("----parsed",parsed)

  if (!parsed.isValid) {
    console.warn(parsed.error)
    console.log("----parsed.error",parsed.error)
    return data
  }

  if (parsed.isGeneric) {
    // Generic case - אולי companies ריק או ערך ברירת מחדל
    data.companies = []
  } else {
    if (!parsed.isGeneric && parsed.companyName) {
      const companies = await req.payload.find({
        collection: 'companies',
        where: { name: { like: parsed.companyName } },
      })
      console.log("-----companies",companies)

    if (companies) {
      const foundCompanies = companies.docs
      data.companies = foundCompanies.map((company) => company.id)
    } else {
      data.companies = []
    }
  }

  return data;
}}
