import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
} from 'payload'
import { parseResearchFilename } from '@/utils/parseResearchFilename'
import { ResearchDocument } from '@/payload-types'

export const validateResearchDocsInMeetings: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  const type = data?.type
  const docIDs = data?.researchDocuments
  const companies = data?.companies || []
  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
    return data
  }
  const validationErrors: { message: string; path: string }[] = []

  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    validationErrors.push({
      message: 'לפגישות מסוג "אג"ח" או "אג"ח כהונת נאמן" ניתן לצרף רק מסמך מחקר (כללי) -אחד בלבד.',
      path: 'researchDocuments',
    })
  } else {
    const query: any = {
      collection: 'research-documents',
      select: {
        id: true,
        companies: true,
        filename: true,
      },
      depth: 0,
      limit: 0,
      where: {
        id: {
          in: docIDs,
        },
      },
    }

    const researchDocuments = await req.payload.find(query)
    if (docIDs.length > 1) {
      const generalDocs = researchDocuments?.docs?.filter(
        (doc) => !('companies' in doc) || (doc.companies && doc.companies.length === 0),
      )
      if (generalDocs.length > 1) {
        validationErrors.push({
          message: 'לא ניתן לצרף יותר ממסמך כללי אחד',
          path: 'researchDocuments',
        })
      }
    }
    //todo: check if the companies in the research documents match the companies in the meeting
    const docs = researchDocuments.docs as ResearchDocument[]
    const invalidFilenames: string[] = []

    docs.forEach((doc) => {
      if (!doc.companies || doc.companies.length === 0) return
      const unmatchedCompanies = doc.companies.filter((company) => !companies.includes(company))
      if (unmatchedCompanies.length > 0 && doc.filename) {
        invalidFilenames.push(doc.filename)
      }
    })

    if (invalidFilenames.length === 1) {
      validationErrors.push({
        message: `${invalidFilenames[0]} - מסמך זה מכיל חברות שאינן מוזמנות לפגישה זו.`,
        path: 'researchDocuments',
      })
    } else if (invalidFilenames.length > 1) {
      const filenamesList = invalidFilenames.map((name) => `- ${name}`).join('\n')
      const filenamesMessage = `מסמכים אלו מכילים חברות שאינן מוזמנות לפגישה זו:\n${filenamesList}`

      validationErrors.push({
        message: filenamesMessage,
        path: 'researchDocuments',
      })
    }

    if (validationErrors.length > 0) {
      throw new ValidationError({ errors: validationErrors })
    }

    return data
  }
}
export const clearCompaniesInSingleBondResearchDoc: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
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
        where: { name: { like: parsed.companyName }, type: { equals: 'regular' } },
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
  if (!Array.isArray(data.agenda)) return data

  await Promise.all(
    data.agenda.map(async (item) => {
      // המלצה רגילה
      if (item.recommendation.reasonRef) {
        const reason = await req.payload.findByID({
          collection: 'recommendation-reasons',
          id: item.recommendation.reasonRef,
        })

        if (reason?.content !== 'אחר' && reason?.content) {
          item.recommendation.reasonText = reason.content
        }
      }

      // המלצה חריגה
      const exceptional = item?.exceptionalRecommendation
      if (exceptional?.showExceptional && exceptional?.reasonRef) {
        const exceptionalReason = await req.payload.findByID({
          collection: 'recommendation-reasons',
          id: exceptional.reasonRef,
        })

        if (exceptionalReason?.content !== 'אחר' && exceptionalReason?.content) {
          exceptional.reasonText = exceptionalReason.content
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
