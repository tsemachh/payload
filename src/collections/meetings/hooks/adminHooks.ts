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
    if (!data.meetingId) {
      data.meetingId = `${Math.floor(Math.random() * 1000000)}`
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
  if (!value) return true

  if (options.req.context.from == 'migration' || options.req.context.from == 'process') {
    return true
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
