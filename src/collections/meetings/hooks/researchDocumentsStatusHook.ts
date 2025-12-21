import { FieldHook } from 'payload'

/**
 * Hook to calculate and update research documents status when research documents change
 * This hook runs after research documents are changed and updates the meeting's researchDocumentsStatus field
 */
export const updateResearchDocumentsStatus: FieldHook = async ({ data, req, value, originalDoc }) => {
  // Skip if this is already a process update to avoid infinite loops
  if (req.context?.from === 'process') {
    return
  }

  // Skip if no meeting ID available
  if (!originalDoc?.id) {
    return
  }

  try {
    // Use setTimeout to defer the update until after the current save operation completes
    setTimeout(async () => {
      try {
        // Get the latest meeting data
        const meeting = await req.payload.findByID({
          collection: 'meetings',
          id: originalDoc.id,
          depth: 0,
        })

        if (!meeting?.companies || !Array.isArray(meeting.companies) || meeting.companies.length === 0) {
          await req.payload.update({
            collection: 'meetings',
            id: originalDoc.id,
            data: { researchDocumentsStatus: 'empty' as const },
            context: { from: 'process' },
          })
          return
        }

        const researchDocs = meeting.researchDocuments || []
        if (researchDocs.length === 0) {
          await req.payload.update({
            collection: 'meetings',
            id: originalDoc.id,
            data: { researchDocumentsStatus: 'empty' as const },
            context: { from: 'process' },
          })
          return
        }

        // Get company IDs
        const companyIds = meeting.companies.map((company: any) =>
          typeof company === 'string' ? company : company.id,
        )

        // Check which companies have research documents
        const companiesWithDocs = new Set()

        for (const docId of researchDocs) {
          try {
            const doc = await req.payload.findByID({
              collection: 'research-documents',
              id: typeof docId === 'string' ? docId : docId.id,
            })

            if (doc?.companies && Array.isArray(doc.companies)) {
              doc.companies.forEach((companyId: any) => {
                const id = typeof companyId === 'string' ? companyId : companyId.id
                if (companyIds.includes(id)) {
                  companiesWithDocs.add(id)
                }
              })
            }
          } catch (error: any) {
            req.payload.logger.error(`Error fetching research document ${docId}:`, error)
          }
        }

        // Determine status
        const totalCompanies = companyIds.length
        const companiesWithDocsCount = companiesWithDocs.size

        let status: 'empty' | 'partial' | 'complete' = 'empty'
        if (companiesWithDocsCount === 0) {
          status = 'empty'
        } else if (companiesWithDocsCount === totalCompanies) {
          status = 'complete'
        } else {
          status = 'partial'
        }

        // Update the meeting's status
        await req.payload.update({
          collection: 'meetings',
          id: originalDoc.id,
          data: { researchDocumentsStatus: status },
          context: { from: 'process' },
        })
      } catch (error: any) {
        req.payload.logger.error('Error in deferred research documents status update:', error)
      }
    }, 100) // Small delay to ensure the main save operation completes first

  } catch (error: any) {
    req.payload.logger.error('Error setting up research documents status update:', error)
  }
}