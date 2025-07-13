import {
  type CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  ValidationError,
} from 'payload'
import { parseResearchFilename } from '@/utils/parseResearchFilename'

const companyIsNotRegular = async (companyName: string, req: any): Promise<boolean> => {
  const result = await req.payload.find({
    collection: 'companies',
    where: {
      name: { like: companyName },
      type: { equals: 'regular' },
    },
    limit: 1,
    depth: 0,
  })
  return result.docs.length === 0
}

export const validateResearchDocsInMeetings: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  if (req.context?.from === 'migration') return data
  const type = data?.type
  const docIDs = data?.researchDocuments
  const companies = data?.companies || []
  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) return data
  const validationErrors: { message: string; path: string }[] = []
  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    validationErrors.push({
      message: 'לפגישות מסוג "אג"ח" או "אג"ח כהונת נאמן" ניתן לצרף רק מסמך מחקר (כללי) אחד בלבד.',
      path: 'researchDocuments',
    })
    throw new ValidationError({ errors: validationErrors })
  }
  // הבאת מסמכי המחקר הרלוונטיים
  const { docs: researchDocs } = await req.payload.find({
    collection: 'research-documents',
    select: { companies: true, filename: true },
    depth: 0,
    limit: 0,
    where: { id: { in: docIDs } },
  })
  type ResearchDoc = { id: string; companies?: string[]; filename?: string }
  const docs = researchDocs as ResearchDoc[]
  // --- בדיקות על מסמכים כלליים ---
  if (docIDs.length > 1) {
    const generalDocs = docs.filter((doc) => !doc.companies || doc.companies.length === 0)
    const invalidGeneral: string[] = []
    for (const doc of generalDocs) {
      const filename = doc.filename || ''
      const result = parseResearchFilename(filename)
      const companyExists =
        result.isValid &&
        !result.isGeneric &&
        result.companyName &&
        (await companyIsNotRegular(result.companyName, req))
      if (companyExists) {
        validationErrors.push({
          message: `המסמך "${filename}" מתייחס לחברה לא קיימת במערכת`,
          path: 'researchDocuments',
        })
      } else {
        invalidGeneral.push(doc.id)
      }
    }
    if (invalidGeneral.length > 1) {
      validationErrors.push({
        message: 'לא ניתן לצרף יותר ממסמך מחקר כללי אחד',
        path: 'researchDocuments',
      })
    }
  }
  // --- בדיקת חברות שאינן מוזמנות לפגישה זו ---
  const invalidFilenames: string[] = []
  docs.forEach((doc) => {
    if (!doc.companies || doc.companies.length === 0) return
    const unmatched = doc.companies.filter((c) => !companies.includes(c))
    if (unmatched.length > 0 && doc.filename) {
      invalidFilenames.push(doc.filename)
    }
  })
  if (invalidFilenames.length === 1) {
    validationErrors.push({
      message: `${invalidFilenames[0]} - מסמך זה מכיל חברות שאינן מוזמנות לפגישה זו.`,
      path: 'researchDocuments',
    })
  } else if (invalidFilenames.length > 1) {
    const list = invalidFilenames.map((f) => `- ${f}`).join('\n')
    validationErrors.push({
      message: `מסמכים אלו מכילים חברות שאינן מוזמנות לפגישה זו:\n${list}`,
      path: 'researchDocuments',
    })
  }
  // --- בדיקת כפילות חברות בין המסמכים ---
  const companyToDocsMap: Record<string, string[]> = {}
  docs.forEach((doc) => {
    const name = doc.filename || 'מסמך ללא שם'
    doc.companies?.forEach((cid) => {
      if (!companyToDocsMap[cid]) companyToDocsMap[cid] = []
      companyToDocsMap[cid].push(name)
    })
  })
  const duplicates = Object.entries(companyToDocsMap).filter(([, files]) => files.length > 1)
  if (duplicates.length > 0) {
    // שליפת שמות החברות לפי ID
    const dupIds = duplicates.map(([cid]) => cid)
    const { docs: companyDocs } = await req.payload.find({
      collection: 'companies',
      select: { id: true, name: true },
      depth: 0,
      limit: 0,
      where: { id: { in: dupIds } },
    })
    const idToName = Object.fromEntries(
      (companyDocs as { id: string; name?: string }[]).map((c) => [c.id, c.name || c.id]),
    )
    if (duplicates.length === 1) {
      const [cid, files] = duplicates[0]
      const list = files.map((f) => `- ${f}`).join('\n')
      validationErrors.push({
        message: `החברה "${idToName[cid]}" מופיעה ביותר ממסמך אחד:\n${list}`,
        path: 'researchDocuments',
      })
    } else {
      const groups = duplicates
        .map(([cid, files]) => {
          const header = `החברה "${idToName[cid]}" מופיעה ב־${files.length} מסמכים:`
          const list = files.map((f) => `  - ${f}`).join('\n')
          return `${header}\n${list}`
        })
        .join('\n\n')
      validationErrors.push({
        message: `החברות הבאות מופיעות ביותר ממסמך אחד:\n\n${groups}`,
        path: 'researchDocuments',
      })
    }
  }
  if (validationErrors.length > 0) {
    throw new ValidationError({ errors: validationErrors })
  }
  return data
}

export const clearCompaniesInSingleBondResearchDoc: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  // Skip processing during migrations
  if (req.context?.from === 'migration') {
    return data
  }

  const type = data?.type
  const docIDs = data?.researchDocuments
  if (
    (type === 'אג"ח' || type === 'אג"ח כהונת נאמן') &&
    Array.isArray(docIDs) &&
    docIDs.length === 1
  ) {
    await req.payload.update({
      collection: 'research-documents',
      id: docIDs[0],
      data: {
        companies: [],
      },
    })
  }
  return data
}

export const beforeValidaCompaniesFromFilename: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  const filename = data?.file?.filename || data?.filename
  if (!filename) return data
  if (data?.companies) {
    return data
  }
  const parsed = parseResearchFilename(filename)

  if (parsed.isGeneric) {
    data.companies = []
  } else {
    if (!parsed.isGeneric && parsed.companyName) {
      const companies = await req.payload.find({
        collection: 'companies',
        where: {
          name: { like: parsed.companyName },
          type: { equals: 'regular' },
          'researchDocuments.showResearchPrivate': { equals: true },
        },
        limit: 0,
      })
      if (companies) {
        const foundCompanies = companies.docs
        data.companies = foundCompanies.map((company) => company.id)
      }
    }
    return data
  }
}

export const handleRecommendationReason: CollectionBeforeChangeHook = async ({ data, req }) => {
  // Skip processing during migrations
  if (req.context?.from === 'migration') {
    return data
  }

  if (!Array.isArray(data.agenda)) return data

  await Promise.all(
    data.agenda.map(async (item) => {
      // המלצה רגילה
      if (item.recommendation.reasonRef) {
        // Check if reasonRef is a string (text field) or an ID (relationship field)
        if (
          typeof item.recommendation.reasonRef === 'string' &&
          item.recommendation.reasonRef !== 'אחר'
        ) {
          // If it's a string and not 'אחר', it might be the content itself
          item.recommendation.reasonText = item.recommendation.reasonRef
        }
      }

      // המלצה חריגה
      const exceptional = item?.exceptionalRecommendation
      if (exceptional?.showExceptional && exceptional?.reasonRef) {
        if (exceptional?.reasonRef !== 'אחר') {
          exceptional.reasonText = exceptional.reasonRef
        }
      }
    }),
  )

  return data
}

export const afterChangeDeleteResearchDocs: CollectionAfterChangeHook = async ({
  doc,
  req,
  previousDoc,
}) => {
  // Skip processing during migrations
  if (req.context?.from === 'migration') {
    return
  }

  const prev = previousDoc?.researchDocuments || []
  const curr = doc?.researchDocuments || []
  const removed = prev.filter((id: string) => !curr.includes(id))

  await Promise.all(
    removed.map(async (id: any) => {
      await req.payload.delete({
        collection: 'research-documents',
        id: id,
      })
    }),
  )
}
