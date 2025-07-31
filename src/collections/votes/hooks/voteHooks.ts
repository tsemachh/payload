import {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  ValidationError,
} from 'payload'
import { Vote } from '@/payload-types'

import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'

/**
 * Hook to handle vote deletion and update meeting counts accordingly
 * Note: This hook should be used as a CollectionAfterDeleteHook, not CollectionAfterChangeHook
 */
export const handleVoteDeletionHook: CollectionAfterDeleteHook<Vote> = async ({ doc, req }) => {
  // Only process if we have a meeting ID and the vote was published
  if (!doc.meeting || typeof doc.meeting !== 'string' || doc._status !== 'published') {
    return
  }

  const meetingId = doc.meeting

  try {
    await recalculateMeetingVoteCounts(req, meetingId) // Decrement the vote count since a published vote was deleted
  } catch (error) {
    req.payload.logger.error(
      `Error updating meeting vote counts after deletion for meeting ${meetingId}:`,
      error,
    )
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

/**
 * Hook to recalculate meeting vote counts when reported status changes
 */
export const recalculateVoteCountsOnReportedChange: CollectionAfterChangeHook<Vote> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const reportedChanged = doc.reported !== previousDoc?.reported

  // Recalculate meeting vote counts when reported status changes
  if (doc._status === 'published' && reportedChanged && doc.meeting) {
    try {
      await recalculateMeetingVoteCounts(req, doc.meeting as string)
    } catch (error) {
      req.payload.logger.error(
        `Error recalculating meeting vote counts for meeting ${doc.meeting}:`,
        error,
      )
    }
  }
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
