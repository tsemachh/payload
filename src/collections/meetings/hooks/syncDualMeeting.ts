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
          percentResult: currentItem.percentResult,
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

    // Create change details for the dual meeting
    let changeDetails = ''

    // Add new change details entry with specific changes
    const changeDate = new Date().toISOString()

    // Build a detailed description of what was changed
    const changesDescription = []

    // Check for changes in general fields
    const fieldsToCheck = [
      { field: 'type', label: 'סוג אסיפה' },
      { field: 'state', label: 'מצב אסיפה' },
      { field: 'holdingsLimit', label: 'מועד קובע' },
      { field: 'proxyVotingDate', label: 'מועד מסירת הצבעה' },
      { field: 'meetingDate', label: 'מועד האסיפה' },
      { field: 'location', label: 'כתובת' },
      { field: 'electronicVotingEnabled', label: 'הצבעה אלקטרונית' },
      { field: 'resultsConfirmationStatus', label: 'אימות תוצאות' },
    ]

    for (const { field, label } of fieldsToCheck) {
      if (JSON.stringify(currentDoc[field]) !== JSON.stringify(previousDoc?.[field])) {
        changesDescription.push(`${label}`)
      }
    }

    // Check for agenda changes
    if (
      currentDoc.agenda &&
      previousDoc?.agenda &&
      JSON.stringify(currentDoc.agenda) !== JSON.stringify(previousDoc.agenda)
    ) {
      changesDescription.push('סדר יום')
    }

    // Check for research documents changes
    if (researchDocsChanged) {
      changesDescription.push('מסמכי מחקר')
    }

    const changeDescription =
      changesDescription.length > 0
        ? `סנכרון שינויים מאסיפה מקורית (${currentDoc.meetingId || currentDoc.id}): ${changesDescription.join(', ')}`
        : `סנכרון שינויים מאסיפה מקורית (${currentDoc.meetingId || currentDoc.id})`

    changeDetails = `${changeDate} - [sync] ${changeDescription}`

    // Update the dual meeting directly using its ID
    await payload.update({
      collection: 'meetings',
      id: currentDoc.dualMeeting,
      data: {
        ...generalFields,
        agenda: updatedAgenda,
        ...(researchDocsChanged && { researchDocuments: genericResearchDocs }),
        changeDetails: changeDetails,
      },
      context: { from: 'process' },
    })
  } catch (error) {
    console.error('Error syncing dual meeting:', error)
  }
}
