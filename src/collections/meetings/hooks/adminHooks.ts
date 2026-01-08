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
  if (req.context?.from === 'migration' || req.context?.from === 'process') return data

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
  if (options.req?.context?.from == 'migration' || options.req?.context?.from == 'process') {
    return true
  }

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
  if (req.context.from == 'migration' || req.context.from == 'process') {
    return data
  }
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

/**
 * Auto-selects the appropriate stockValue on meeting create or when holdingsLimit/stock changes.
 * Logic:
 * - If holdingsLimit exists: choose the latest stock-value with valueDate <= holdingsLimit.
 * - Otherwise: choose the latest stock-value (no date constraint).
 * - Consider both the meeting stock and its dual counterpart (same OR used in field filterOptions).
 * Skips when called from migration/process contexts.
 */
export const setStockValueOnCreateOrHoldingsChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  try {
    if (req.context?.from === 'process' || req.context?.from === 'migration') {
      return data
    }

    // Only when creating, or when holdingsLimit/stock changed
    const stockChanged =
      String(getIdOfRelationField(originalDoc?.stock) || '') !==
      String(getIdOfRelationField(data?.stock) || '')
    const holdingsChanged =
      (originalDoc?.holdingsLimit || '')?.toString() !== (data?.holdingsLimit || '')?.toString()

    if (!(operation === 'create' || stockChanged || holdingsChanged)) {
      return data
    }

    const stockId = getIdOfRelationField(data?.stock)
    if (!stockId) return data

    const where: any = {
      or: [{ stockId: { equals: stockId } }, { 'stockId.dualStock': { equals: stockId } }],
    }

    if (data?.holdingsLimit) {
      const limit = new Date(String(data.holdingsLimit)).toISOString()
      where.valueDate = { less_than_equal: limit }
    }

    const res = await req.payload.find({
      collection: 'stock-values',
      depth: 0,
      where,
      sort: '-valueDate',
      limit: 1,
    })

    const sv = res?.docs?.[0]
    if (sv?.id) {
      const current = String(getIdOfRelationField(data?.stockValue) || '')
      if (current !== String(sv.id)) {
        data.stockValue = sv.id
      }
    }
  } catch (e) {
    console.error('setStockValueOnCreateOrHoldingsChange error:', e)
  }
  return data
}

export const handleResult: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
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

  // If user is explicitly setting finalized to false, respect that choice
  if (originalDoc?.finalized === true && data.finalized === false) {
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
