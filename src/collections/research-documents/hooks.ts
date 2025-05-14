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

export const validateResearchDocsHook: CollectionBeforeValidateHook = async ({ data, req }) => {
  console.log('****** Entered validateResearchDocsHook ******')

  const type = data?.type
  const docIDs = data?.['research-documents']

  console.log('****** Meeting type:', type)
  console.log('****** Research document IDs:', docIDs)

  if (!docIDs || !Array.isArray(docIDs) || docIDs.length === 0) {
    console.log('****** No research documents found - exiting hook')
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
  console.log(`****** Found ${docs.length} research documents`)

  for (const doc of docs) {
    console.log(`****** Checking file: ${doc.filename}`)

    if (!doc.filename) continue

    const parsed = parseResearchFilename(doc.filename)
    console.log('****** Parsed result:', parsed)

    if (!parsed.isValid) {
      throw new Error(`Filename "${doc.filename}": ${parsed.error}`)
    }

    if (!parsed.isGeneric && parsed.companyName) {
      const companyResult = await req.payload.find({
        collection: 'companies',
        where: { name: { equals: parsed.companyName } },
      })

      if (companyResult.docs.length === 0) {
        throw new Error(`Filename "${doc.filename}": No company found with name "${parsed.companyName}"`)
      }

      const companyId = companyResult.docs[0].id

      await req.payload.update({
        collection: 'research-documents',
        id: doc.id,
        data: {
          company: companyId,
        },
      })

      console.log(`****** Linked company "${parsed.companyName}" to research document "${doc.filename}"`)
    }
  }

  if ((type === 'אג"ח' || type === 'אג"ח כהונת נאמן') && docIDs.length > 1) {
    throw new Error('Only one research document is allowed for אג"ח or אג"ח כהונת נאמן meetings')
  }

  return data
}
