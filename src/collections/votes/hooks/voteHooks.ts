import {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'
import { Vote } from '@/payload-types'

import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'

/**
 * Hook to handle vote deletion and update meeting counts accordingly
 * Note: This hook should be used as a CollectionAfterDeleteHook, not CollectionAfterChangeHook
 */
export const handleVoteDeletionHook: CollectionAfterDeleteHook<Vote> = async ({ doc, req }) => {
  // Only process if we have a meeting ID and the vote was published
  if (!doc.meeting || typeof doc.meeting !== 'string') {
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

export const setVoteFlags: CollectionBeforeChangeHook<Vote> = async ({ data, req ,originalDoc}) => {
  
  if (data._status === 'published') {
    if (originalDoc?.publishedchecksum != '' && originalDoc?.publishedchecksum != data.checksum) {
      data.reported = false
      data.publishedchecksum = data.checksum
    }}

  const meetingId = data?.meeting
  const votes = data?.votes

  if (!meetingId || !votes) return data

  const meeting = await req.payload.findByID({
    collection: 'meetings',
    id: String(meetingId), // Explicitly cast to string
    depth: 0,
  })
  const agenda = meeting?.agenda || []
  let hasVoteAgainstRecommendation = false
  let hasVoteDifferentFromResult = false

  const resultToVoteMap: Record<string, string> = {
    '1': 'בעד',
    '2': 'נגד',
    '3': 'דיון',
  }

  for (const vote of votes) {
    const topicIndex = vote.topicIndex
    const voteDecision = vote.voteDecision
    const agendaItem = agenda[topicIndex - 1]
    if (!agendaItem) continue

    const recommendation = agendaItem.recommendation?.votingRecommendation
    if (recommendation && voteDecision && voteDecision !== recommendation) {
      hasVoteAgainstRecommendation = true
    }

    const result = agendaItem.result
    if (!result) continue
    const mappedResult = resultToVoteMap[result]
    if (mappedResult && voteDecision && voteDecision !== mappedResult) {
      hasVoteDifferentFromResult = true
    }

    if (hasVoteAgainstRecommendation && hasVoteDifferentFromResult) break
  }

  return {
    ...data,
    voteAgainstRecommendation: hasVoteAgainstRecommendation,
    voteDifferentFromResult: hasVoteDifferentFromResult,
  }
}

/**
 * Hook to recalculate meeting vote counts when reported status changes or status changes between published and draft
 */
export const recalculateVoteCountsOnReportedChange: CollectionAfterChangeHook<Vote> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (
    req.context?.from == 'migration' ||
    req.context?.from == 'process' ||
    req.context?.from == 'calc'
  ) {
    return
  }
  const reportedChanged = doc.reported !== previousDoc?.reported
  const statusChangedFromPublishedToDraft =
    previousDoc?._status === 'published' && doc._status === 'draft'
  const statusChangedFromDraftToPublished =
    previousDoc?._status === 'draft' && doc._status === 'published'
  const statusChanged = statusChangedFromPublishedToDraft || statusChangedFromDraftToPublished
 
  if (
    (doc._status === 'published' && reportedChanged && doc.meeting) ||
    (statusChanged && doc.meeting)
  ) {
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
