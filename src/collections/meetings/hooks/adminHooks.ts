import {
  type CollectionBeforeChangeHook,
  SelectFieldSingleValidation,
  TextFieldSingleValidation,
} from 'payload'
import { getCollectionDoc, getIdOfRelationField } from '@/utils/utils'
import { normalizeDate } from '@/utils/dateUtils'

export const beforeChangeMeetingId: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation == 'create') {
    if (!data.primaryLegacyId) {
      data.primaryLegacyId = `${Math.floor(Math.random() * 1000000)}`
    }
  }
  return data
}

export const validateMeetingInvitationLink: TextFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
    return true
  }
  if (options.siblingData.magnaId || options.siblingData.invitationDocument || value) return true
  return 'יש להזין קישור לזימון, אסמכתא או מסמך זימון'
}
export const validateMeetingState: SelectFieldSingleValidation = (
  value: string | null | undefined,
  options: any,
) => {
  if (
    !value &&
    !(options.req.context.from == 'migration' || options.req.context.from == 'process')
  ) {
    return 'יש לבחור מצב אסיפה'
  }

  const { siblingData } = options
  const currentDate = new Date()
  const meetingDate = siblingData.meetingDate ? new Date(siblingData.meetingDate) : null

  if (value === 'on-hold' && !meetingDate) return true
  if (!meetingDate) return 'יש לספק מועד אסיפה'

  const today = normalizeDate(currentDate)
  const meetingDay = normalizeDate(meetingDate)

  switch (value) {
    case 'completed':
      if (meetingDay > today) {
        return 'מצב ״התקיימה״ מתאפשר רק לאסיפות שמועדן אתמול או בעבר'
      }
      break

    case 'postponed':
      if (meetingDay < today) {
        return 'מצב ״נדחית״ מתאפשר רק לאסיפות שמועדן היום או בעתיד'
      }
      break

    case 'scheduled':
      if (meetingDay < today) {
        return 'מצב ״מתוכננת״ מתאפשר רק לאסיפות שמועדן היום או בעתיד'
      }
      break
  }

  return true
}

export const updateStockRegisteredValue: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  // Update stockRegisteredValue when stockValue changes
  const currentStockValue = getIdOfRelationField(data?.stockValue)
  const previousStockValue = getIdOfRelationField(originalDoc?.stockValue)

  if (currentStockValue && currentStockValue !== previousStockValue) {
    try {
      const stockValueDoc = await getCollectionDoc(
        req,
        'stock-values',
        String(currentStockValue),
        0,
      )
      data.stockRegisteredValue = stockValueDoc?.registeredValue || 0
      console.log(
        'Updated stockRegisteredValue:',
        data.stockRegisteredValue,
        'for stock value:',
        currentStockValue,
      )
    } catch (error) {
      console.error('Error fetching stock value for registeredValue:', error)
      data.stockRegisteredValue = 0
    }
  }
  return data
}

export const handleResult: CollectionBeforeChangeHook = async ({ data, req }) => {
  // Skip if context is from migration or process
  if (req.context?.from === 'migration' || req.context?.from === 'process') {
    return data
  }

  // Only check if meeting is in 'completed' state
  if (data.state !== 'completed') {
    return data
  }

  // Check if agenda exists and has items
  if (!data.agenda || !Array.isArray(data.agenda) || data.agenda.length === 0) {
    return data
  }

  // Filter agenda items that require a decision and are not removed
  const decisionItems = data.agenda.filter(
    (item: any) => item.topicType === 'decision' && !item.isRemovedFromAgenda,
  )

  // If there are no decision items, don't change state
  if (decisionItems.length === 0) {
    return data
  }

  // Check if all decision items have results
  const allHaveResults = decisionItems.every((item: any) => {
    return item.result && item.result !== '0'
  })

  // If all decision items have results, set finalized to true
  if (allHaveResults) {
    data.finalized = true
  }

  return data
}
