import { addDays } from '@/utils/dateUtils'
import { createAdminNotification, getIdOfRelationField } from '@/utils/utils'
import {
  type CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  ValidationError,
} from 'payload'
import { Meeting } from '@/payload-types'

export const notifyVoteAfterHoldingLimit: CollectionAfterChangeHook = async ({
  doc,
  req,
  previousDoc,
}) => {
  if (doc._status === 'published' && doc._status !== previousDoc?._status) {
    try {
      let meeting: Meeting | string = doc.meeting
      if (typeof meeting === 'string') {
        meeting = await req.payload.findByID({
          collection: 'meetings',
          id: meeting,
        })
      }

      if (meeting?.holdingsLimit) {
        const holdingsLimit = new Date(meeting.holdingsLimit)
        const dayAfterHoldings = addDays(holdingsLimit, 1)

        if (new Date() > dayAfterHoldings) {
          const meetingName = meeting?.fullName
          const message = `הצבעה חדשה פורסמה לאחר המועד הקובע עבור ${meetingName}`
          const url = `/admin/collections/votes/${doc.id}`
          const relatedCompany = getIdOfRelationField(doc.company)

          try {
            await req.payload.delete({
              collection: 'admin-notifications',
              where: {
                relatedCompany: { equals: relatedCompany },
                message: { equals: message },
                url: { equals: url },
                user: { equals: req?.user?.id },
              },
            })
          } catch (error) {
            req.payload.logger.error(`Error deleting admin notification: ${JSON.stringify(error)}`)
          }

          await createAdminNotification(
            req.payload,
            message,
            'newVoteAfterHoldingLimit',
            url,
            relatedCompany as string,
            req?.user?.id,
          )
        }
      }
    } catch (error) {
      console.error('Error creating notification for published vote:', error)
    }
  }
}

export const updateReportedAndMeetingHoldings: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  if (data._status === 'published' && data.reported && !originalDoc?.reported) {
    data.reportedBy = data.updator || req.user?.name
    data.reportedTime = new Date().toISOString()
  }

  if (
    data._status === 'published' &&
    data.meeting &&
    data.fundsWithHoldingsUpdates &&
    JSON.stringify(originalDoc?.fundsWithHoldingsUpdates) !==
      JSON.stringify(data.fundsWithHoldingsUpdates)
  ) {
    try {
      const meetingId = data.meeting
      const updates = data.fundsWithHoldingsUpdates

      if (meetingId && typeof updates === 'object') {
        const meeting = await req.payload.findByID({
          collection: 'meetings',
          id: meetingId,
          depth: 0,
        })

        if (!meeting) {
          throw new Error('לא נמצאה אסיפה מתאימה')
        }

        const updatedFundsWithHolding = (meeting.fundsWithHolding || []).map((fund: any) => {
          const update = updates[fund.fund]
          if (update) {
            return {
              ...fund,
              ownedQuantity:
                update.ownedQuantity !== undefined && update.ownedQuantity !== null
                  ? update.ownedQuantity
                  : 0,
            }
          }
          return fund
        })

        await req.payload.update({
          collection: 'meetings',
          id: meetingId,
          data: {
            fundsWithHolding: updatedFundsWithHolding,
          },
          req,
        })
      }
    } catch (error) {
      console.error('Error updating meeting:', error)
      throw new Error('Failed to update meeting fundsWithHolding')
    }
  }

  return data
}

export const validateOwnedQuantityWhenUnauthorized: CollectionBeforeValidateHook = async ({
  data,
}) => {
  const updates = data?.fundsWithHoldingsUpdates
  const validationErrors: { message: string; path: string }[] = []

  if (updates && typeof updates === 'object') {
    type FundUpdate = { isAuthorized?: string; ownedQuantity?: number | null }
    Object.entries(updates).forEach(([fundId, updateRaw]) => {
      const update = updateRaw as FundUpdate
      if (
        update &&
        update.isAuthorized === 'unchecked' &&
        (update.ownedQuantity === null || update.ownedQuantity === undefined)
      ) {
        validationErrors.push({
          message: 'חובה להזין ערך נקוב ברשות כאשר אין תאום בערכים',
          path: `reported`,
        })
      }
    })
  }

  if (validationErrors.length > 0) {
    throw new ValidationError({ errors: validationErrors })
  }

  return data
}
