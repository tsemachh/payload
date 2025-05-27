import { error } from 'console'
import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type CollectionAfterChangeHook,
} from 'payload'
import { parseResearchFilename } from '@/utils/parseResearchFilename'
import { getSubtreeExcludingLeaves } from '@/utils/getSubCompanies'

export const validateResearchDocsInMeetings: CollectionBeforeValidateHook = async ({
  data,
  req,
}) => {
  const type = data?.type
  const docIDs = data?.researchDocuments
  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
    return data
  }
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
  if (data?.companies) {
    const validCompaniesSet = await getSubtreeExcludingLeaves({ ids: data.companies, req })
    data.companies = Array.from(validCompaniesSet)
    return data
  }
  const parsed = parseResearchFilename(filename)

  if (parsed.isGeneric) {
    data.companies = []
  } else {
    if (!parsed.isGeneric && parsed.companyName) {
      const companies = await req.payload.find({
        collection: 'companies',
        where: { name: { like: parsed.companyName } },
      })
      if (companies) {
        const foundCompanies = companies.docs
        const ids = foundCompanies.map((company) => company.id)
        const validCompaniesSet = await getSubtreeExcludingLeaves({ ids: ids, req })
        data.companies = Array.from(validCompaniesSet)
      }
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

  await Promise.all(
    removed.map(async (id: any) => {
      await req.payload.delete({
        collection: 'research-documents',
        id: id,
      })
    }),
  )
}
