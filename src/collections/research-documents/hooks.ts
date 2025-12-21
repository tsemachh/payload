import {
  type CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  ValidationError,
} from 'payload'
import { parseResearchFilename } from '@/utils/parseResearchFilename'



// Hook to update hasCompleteResearchDocuments in meetings when research documents change
export const updateMeetingResearchStatus: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  try {
    // Get all meetings that reference this research document
    const meetings = await req.payload.find({
      collection: 'meetings',
      where: {
        researchDocuments: {
          contains: doc.id
        }
      },
      limit: 0
    })

    // Update each meeting's researchDocumentsStatus
    for (const meeting of meetings.docs) {
      await req.payload.update({
        collection: 'meetings',
        id: meeting.id,
        data: {
          // This will trigger the beforeChange hook that calculates researchDocumentsStatus
          researchDocuments: meeting.researchDocuments
        }
      })
    }

    // Update companies' hasResearchDocuments status
    const companyIds = doc.companies || []
    for (const companyId of companyIds) {
      try {
        const companyIdStr = typeof companyId === 'string' ? companyId : companyId.id
        const company = await req.payload.findByID({
          collection: 'companies',
          id: companyIdStr
        })
        
        if (company) {
          // Trigger a simple update to recalculate hasResearchDocuments
          await req.payload.update({
            collection: 'companies',
            id: company.id,
            data: {
              // Just update the same data to trigger the beforeChange hook
              name: company.name
            }
          })
        }
      } catch (error: any) {
        req.payload.logger.error(`Error updating company ${companyId} research status:`, error)
      }
    }

    req.payload.logger.info(`Updated research document status for ${meetings.totalDocs} meetings and ${companyIds.length} companies`)
  } catch (error: any) {
    req.payload.logger.error('Error updating meeting research status:', error)
  }
}

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
  
  // This is still a critical error that should block
  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    validationErrors.push({
      message: 'לפגישות מסוג "אג"ח" או "אג"ח כהונת נאמן" ניתן לצרף רק מסמך מחקר (כללי) אחד בלבד.',
      path: 'researchDocuments',
    })
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
      req,
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
  if (req.context?.from === 'migration' || req.context?.from === 'process') {
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
