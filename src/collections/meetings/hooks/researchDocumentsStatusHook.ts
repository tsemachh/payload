import { FieldHook } from 'payload'

/**
 * Hook to calculate and update research documents status when research documents change
 * This hook runs after research documents are changed and updates the meeting's researchDocumentsStatus field
 * 
 * Uses the same logic as ResearchDocumentsView to determine which companies should show red X marks
 * Status is "complete" when no red X marks would be shown (all companies with relevant permissions have required docs)
 */
export const updateResearchDocumentsStatus: FieldHook = async ({
  data,
  req,
  value,
  originalDoc,
}) => {
  // Skip if this is already a process update to avoid infinite loops
  if (req.context?.from === 'process' || req.context?.from === 'migration') {
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
        const startTime = Date.now()
        
        const meeting = {
          ...originalDoc,
          ...data, // Apply any changes from the current update
        }


        if (
          !meeting?.companies ||
          !Array.isArray(meeting.companies) ||
          meeting.companies.length === 0
        ) {
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

        const meetingType = meeting.type || 'regular'
        
        // Determine which columns to show based on meeting type (same logic as ResearchDocumentsView)
        const getColumnsToShow = () => {
          switch (meetingType) {
            case 'אג"ח':
              return {
                showPrivate: false,
                showGeneral: false,
                showBond: true,
                showTrusteeship: false
              }
            case 'אג"ח כהונת נאמן':
              return {
                showPrivate: false,
                showGeneral: false,
                showBond: false,
                showTrusteeship: true
              }
            default: // regular
              return {
                showPrivate: true,
                showGeneral: true,
                showBond: false,
                showTrusteeship: false
              }
          }
        }
        
        const columnsToShow = getColumnsToShow()

        // Get company IDs and check their permissions
        const companyIds = meeting.companies.map((company: any) =>
          typeof company === 'string' ? company : company.id,
        )

        const companiesWithPermissions = await req.payload.find({
          collection: 'companies',
          where: {
            id: { in: companyIds }
          },
          select: {
            researchDocuments: true
          },
          limit: companyIds.length,
          pagination: false
        })
        
        
        const companiesWithRelevantPermissions = companiesWithPermissions.docs
          .filter((company: any) => {
            const researchSettings = company.researchDocuments
            let hasRelevantPermissions = false
            
            // Check permissions based on meeting type (same logic as ResearchDocumentsView)
            if (columnsToShow.showPrivate && researchSettings?.showResearchPrivate) {
              hasRelevantPermissions = true
            }
            if (columnsToShow.showGeneral && researchSettings?.showResearch) {
              hasRelevantPermissions = true
            }
            if (columnsToShow.showBond && researchSettings?.showResearchBond) {
              hasRelevantPermissions = true
            }
            if (columnsToShow.showTrusteeship && researchSettings?.showResearchTrusteeship) {
              hasRelevantPermissions = true
            }
            
            return hasRelevantPermissions
          })
          .map((company: any) => company.id)

        if (companiesWithRelevantPermissions.length === 0) {
          await req.payload.update({
            collection: 'meetings',
            id: originalDoc.id,
            data: { researchDocumentsStatus: 'empty' as const },
            context: { from: 'process' },
          })
          return
        }

        // Check which companies have research documents - using same logic as ResearchDocumentsView
        const companiesWithDocs = new Set()

        if (researchDocs.length > 0) {
          const allResearchDocs = await req.payload.find({
            collection: 'research-documents',
            where: {
              id: { in: researchDocs.map((docId: any) => typeof docId === 'string' ? docId : docId.id) }
            },
            select: {
              companies: true
            },
            limit: researchDocs.length,
            pagination: false
          })

          console.log(`📄 Found ${allResearchDocs.totalDocs} research documents`)

          // Helper functions (same as ResearchDocumentsView)
          const getResearchDocForCompanyDirect = (companyId: string, researchDocuments: any[]): any => {
            return researchDocuments.find((doc) =>
              doc.companies?.some((docCompany: any) => {
                if (typeof docCompany === 'string') {
                  return docCompany === companyId
                } else if (docCompany?.id) {
                  return docCompany.id === companyId
                } else if (docCompany?.docs && Array.isArray(docCompany.docs)) {
                  return docCompany.docs.includes(companyId)
                }
                return false
              })
            )
          }

          const hasGeneralResearchDoc = (researchDocuments: any[]): boolean => {
            return researchDocuments.some(doc => !doc.companies || doc.companies.length === 0)
          }

          const hasBondResearchDoc = (researchDocuments: any[]): boolean => {
            return researchDocuments.length > 0
          }

          const hasTrusteeshipResearchDoc = (researchDocuments: any[]): boolean => {
            return researchDocuments.length > 0
          }

          // Check each company with relevant permissions
          for (const companyId of companiesWithRelevantPermissions) {
            const company = companiesWithPermissions.docs.find(c => c.id === companyId)
            if (!company) continue

            const researchSettings = company.researchDocuments
            let hasRequiredDocs = true

            console.log(`🔍 Checking company ${companyId} for required documents...`)

            // Check private research document (same logic as ResearchDocumentsView)
            if (columnsToShow.showPrivate && researchSettings?.showResearchPrivate) {
              const hasPrivateDoc = !!getResearchDocForCompanyDirect(companyId, allResearchDocs.docs)
              console.log(`📄 Company ${companyId} private doc: ${hasPrivateDoc ? '✅' : '❌'}`)
              if (!hasPrivateDoc) {
                hasRequiredDocs = false
              }
            }

            // Check general research document
            if (columnsToShow.showGeneral && researchSettings?.showResearch) {
              const hasGeneralDoc = hasGeneralResearchDoc(allResearchDocs.docs)
              console.log(`📄 Company ${companyId} general doc: ${hasGeneralDoc ? '✅' : '❌'}`)
              if (!hasGeneralDoc) {
                hasRequiredDocs = false
              }
            }

            // Check bond research document
            if (columnsToShow.showBond && researchSettings?.showResearchBond) {
              const hasBondDoc = hasBondResearchDoc(allResearchDocs.docs)
              console.log(`📄 Company ${companyId} bond doc: ${hasBondDoc ? '✅' : '❌'}`)
              if (!hasBondDoc) {
                hasRequiredDocs = false
              }
            }

            // Check trusteeship research document
            if (columnsToShow.showTrusteeship && researchSettings?.showResearchTrusteeship) {
              const hasTrusteeshipDoc = hasTrusteeshipResearchDoc(allResearchDocs.docs)
              if (!hasTrusteeshipDoc) {
                hasRequiredDocs = false
              }
            }

            if (hasRequiredDocs) {
              companiesWithDocs.add(companyId)
            } else {
              console.log(`❌ Company ${companyId} missing required documents`)
            }
          }
        }


        // Determine status based on companies WITH RELEVANT PERMISSIONS only
        const totalCompaniesWithRelevantPermissions = companiesWithRelevantPermissions.length
        const companiesWithDocsCount = companiesWithDocs.size


        let status: 'empty' | 'partial' | 'complete' = 'empty'
        if (companiesWithDocsCount === 0) {
          status = 'empty'
        } else if (companiesWithDocsCount === totalCompaniesWithRelevantPermissions) {
          // 🚀 Status is complete when ALL companies with relevant permissions have all required docs
          status = 'complete'
        } else {
          status = 'partial'
        }

        const processingTime = Date.now() - startTime
        req.payload.logger.info(`Research docs status: ${companiesWithDocsCount}/${totalCompaniesWithRelevantPermissions} companies with relevant permissions have all required docs -> ${status} (${processingTime}ms)`)

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