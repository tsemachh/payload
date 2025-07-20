import { Payload } from 'payload'

const hasRelevantChanges = (currentDoc: any, previousDoc: any) => {
  const fieldsToCheck = [
    'type',
    'meetingId',
    'magnaId',
    'invitationLink',
    'invitationDocument',
    'state',
    'holdingsLimit',
    'proxyVotingDate',
    'meetingDate',
    'location',
    'comments',
    'resultsConfirmationStatus',
    'electronicVotingEnabled',
    'committeeInitiated',
    'agenda',
    'researchDocuments',
  ]

  return fieldsToCheck.some(
    (field) => JSON.stringify(currentDoc[field]) !== JSON.stringify(previousDoc?.[field]),
  )
}

export const syncDualMeeting = async (payload: Payload, currentDoc: any, previousDoc?: any) => {
  try {
    if (!hasRelevantChanges(currentDoc, previousDoc) || !currentDoc.dualMeeting) {
      return
    }

    // Update existing agenda items and add new ones
    const updatedAgenda = currentDoc.agenda?.map((currentItem: any) => {
      // Try to find matching agenda item in previous doc
      const existingItem = previousDoc?.agenda?.find((a: any) => a.text === currentItem.text)

      if (existingItem) {
        return {
          ...existingItem,
          text: currentItem.text,
          isRemovedFromAgenda: currentItem.isRemovedFromAgenda,
          topicType: currentItem.topicType,
          majorityType: currentItem.majorityType,
          recommendation: currentItem.recommendation,
          vPercentSpecial: currentItem.vPercentSpecial,
          result: currentItem.result,
          // Keep existing exceptional recommendations
          exceptionalRecommendation: existingItem.exceptionalRecommendation,
        }
      } else {
        // This is a new agenda item
        return {
          ...currentItem,
          exceptionalRecommendation: {
            showExceptional: false,
            companies: [],
          },
        }
      }
    })

    // Handle research documents (only generic ones)
    const genericResearchDocs = currentDoc.researchDocuments?.filter((doc: any) => {
      return !doc.companies || doc.companies.length === 0
    })

    const researchDocsChanged =
      JSON.stringify(
        previousDoc?.researchDocuments?.filter(
          (doc: any) => !doc.companies || doc.companies.length === 0,
        ),
      ) !== JSON.stringify(genericResearchDocs)

    const generalFields = {
      type: currentDoc.type,
      magnaId: currentDoc.magnaId,
      invitationLink: currentDoc.invitationLink,
      invitationDocument: currentDoc.invitationDocument,
      state: currentDoc.state,
      holdingsLimit: currentDoc.holdingsLimit,
      proxyVotingDate: currentDoc.proxyVotingDate,
      meetingDate: currentDoc.meetingDate,
      location: currentDoc.location,
      comments: currentDoc.comments,
      resultsConfirmationStatus: currentDoc.resultsConfirmationStatus,
      electronicVotingEnabled: currentDoc.electronicVotingEnabled,
      committeeInitiated: currentDoc.committeeInitiated,
    }

    // Update the dual meeting directly using its ID
    await payload.update({
      collection: 'meetings',
      id: currentDoc.dualMeeting,
      data: {
        ...generalFields,
        agenda: updatedAgenda,
        ...(researchDocsChanged && { researchDocuments: genericResearchDocs }),
      },
      context: { from: 'process' },
    })
  } catch (error) {
    console.error('Error syncing dual meeting:', error)
  }
}
