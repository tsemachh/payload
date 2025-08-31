import { UserVote, VoteDataType } from '@/app/(frontend)/types/vote'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { addDays } from '@/utils/dateUtils'
import { createAdminNotification } from '@/utils/utils'
import { Meeting } from '@/payload-types'

import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'

export const getVoteByMeetingAndCompanies = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  try {
    const { meetingId, companiesIds, status } = req.query

    if (!meetingId || !companiesIds || !status) {
      return Response.json(
        { error: 'Meeting ID, Company IDs and Status are required' },
        { status: 400 },
      )
    }

    const companiesIdsArray = (companiesIds as string).split(',')
    const meetingIdString = meetingId as string
    const statusString = status as string

    const existingVotes = await req.payload.find({
      collection: 'votes',
      where: {
        and: [
          { meeting: { equals: meetingIdString } },
          { company: { in: companiesIdsArray } },
          statusString === 'draft' ? {} : { _status: { equals: statusString } },
        ],
      },
      draft: statusString === 'draft',
      depth: 1,
      limit: companiesIdsArray.length,
    })

    return Response.json(existingVotes.docs, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}

export const getVotedCompanies = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  try {
    const { meetingId, companiesIds } = req.query

    if (!meetingId || !companiesIds) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }

    const companiesIdsArray = (companiesIds as string).split(',')
    const meetingIdString = meetingId as string

    const existingVotes = await req.payload.find({
      select: { company: true },
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingIdString } }, { company: { in: companiesIdsArray } }],
      },
      draft: true,
      depth: 0,
      limit: companiesIdsArray.length,
    })

    return Response.json(existingVotes.docs, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}

export const upsertVote = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  try {
    const body = req.json ? await req.json() : null
    if (!body) return Response.json({ error: 'Invalid request format' }, { status: 400 })

    const { meetingId, votingData, companiesIds } = body

    if (!meetingId || !companiesIds?.length) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }

    await upsertVotesInternal({ req, meetingId, companiesIds, votingData })

    // Recalculate meeting vote counts to ensure consistency
    await recalculateMeetingVoteCounts(req, meetingId)

    return Response.json({ success: true }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}

export const publishVotes = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  try {
    const body = req.json ? await req.json() : null
    if (!body) return Response.json({ error: 'Invalid request format' }, { status: 400 })

    const { meetingId, companiesIds, votingData } = body

    if (!meetingId || !companiesIds?.length) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }

    const votesToPublish = await req.payload.find({
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingId } }, { company: { in: companiesIds } }],
      },
      draft: true,
      depth: 0,
      limit: companiesIds.length,
      overrideAccess: true,
    })

    if (!votesToPublish.docs.length) {
      if (!votingData) {
        return Response.json(
          { error: 'Voting data required when creating new votes' },
          { status: 400 },
        )
      }
      votesToPublish.docs = await upsertVotesInternal({ req, meetingId, companiesIds, votingData })
    }

    await Promise.all(
      votesToPublish.docs.map((vote) =>
        req.payload.update({
          collection: 'votes',
          id: vote.id,
          data: {
            _status: 'published',
          },
          draft: false,
          overrideAccess: true,
          req,
        }),
      ),
    )

    // Check if votes were published after holding limit and create admin notification
    try {
      await recalculateMeetingVoteCounts(req, meetingId)
      // Get meeting details
      const meeting = (await req.payload.findByID({
        collection: 'meetings',
        select: { holdingsLimit: true, fullName: true },
        id: meetingId,
      })) as Meeting
      if (meeting?.holdingsLimit) {
        const holdingsLimit = new Date(meeting.holdingsLimit)
        const dayAfterHoldings = addDays(holdingsLimit, 1)

        if (new Date() > dayAfterHoldings) {
          const meetingName = meeting?.fullName
          const message = `הצבעה חדשה פורסמה לאחר המועד הקובע עבור ${meetingName}`
          const url = `/admin/collections/meetings/${meetingId}`

          // Delete any existing notifications with the same message
          try {
            await req.payload.delete({
              collection: 'admin-notifications',
              where: {
                companies: { contains: companiesIds },
                message: { equals: message },
                meeting: { equals: meetingId },
                url: { equals: url },
                relatedUser: { equals: req?.user?.id },
              },
            })
          } catch (error) {
            req.payload.logger.error(`Error deleting admin notification: ${JSON.stringify(error)}`)
          }

          // Create one notification with all companies and meeting ID
          await createAdminNotification(
            req.payload,
            message,
            'newVoteAfterHoldingLimit',
            url,
            companiesIds,
            req?.user?.id,
            meetingId,
          )
        }
      }
    } catch (error) {
      console.error('Error creating notification for published votes:', error)
    }

    return Response.json(
      votesToPublish.docs.length === 1
        ? { success: true, message: 'פורסמה בהצלחה הצבעה אחת' }
        : { success: true, message: `פורסמו בהצלחה ${votesToPublish.docs.length} הצבעות` },
      { status: 200 },
    )
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}

const upsertVotesInternal = async ({
  req,
  meetingId,
  companiesIds,
  votingData,
}: {
  req: PayloadRequest
  meetingId: string
  companiesIds: string[]
  votingData: VoteDataType
}) => {
  const generalFields = {
    isInterested: votingData.generalVotingData.isInterested,
    interestedExplanation: votingData.generalVotingData.interestedExplanation,
    isSeniorOfficial: votingData.generalVotingData.isSeniorOfficial,
    seniorOfficialExplanation: votingData.generalVotingData.seniorOfficialExplanation,
    isInstitutionalInvestor: votingData.generalVotingData.isInstitutionalInvestor,
    clientComment: votingData.voterNotes,
    voteDocuments: votingData.voteDocuments || [],
  }

  const agendaVotesFormatted = votingData.userVotes.map((userVote: UserVote) => ({
    topicIndex: userVote.topicIndex,
    voteDecision: userVote.choice,
    hasConflictOfInterest: userVote.questions.hasConflictOfInterest,
    conflictOfInterestExplanation: userVote.questions.conflictOfInterestExplanation,
    isRelatedParty: userVote.questions.isRelatedParty,
    relatedPartyExplanation: userVote.questions.relatedPartyExplanation,
    isInvestmentCommittee: userVote.questions.isInvestmentCommittee,
    hasPersonalInterest: userVote.questions.hasPersonalInterest,
    personalInterestExplanation: userVote.questions.personalInterestExplanation,
  }))

  const existingVotes = await req.payload.find({
    collection: 'votes',
    where: {
      and: [{ meeting: { equals: meetingId } }, { company: { in: companiesIds } }],
    },
    depth: 0,
    limit: companiesIds.length,
    overrideAccess: true,
  })

  const existingCompanyMap = new Map()
  existingVotes.docs.forEach((vote) => {
    const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
    if (companyId) existingCompanyMap.set(companyId, vote)
  })

  const toUpdate: Array<{ id: string; data: any }> = []
  const toCreate: Array<any> = []

  companiesIds.forEach((companyId) => {
    const voteData = {
      ...generalFields,
      company: companyId,
      meeting: meetingId,
      votes: agendaVotesFormatted,
    }

    if (existingCompanyMap.has(companyId)) {
      toUpdate.push({ id: existingCompanyMap.get(companyId).id, data: voteData })
    } else {
      toCreate.push(voteData)
    }
  })

  const createdVotes: any[] = []

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((updateItem) =>
        req.payload.update({
          collection: 'votes',
          id: updateItem.id,
          data: updateItem.data,
          draft: true,
          overrideAccess: true,
          req,
        }),
      ),
    )
  }

  if (toCreate.length > 0) {
    const results = await Promise.all(
      toCreate.map((createData) =>
        req.payload.create({
          collection: 'votes',
          data: createData,
          draft: true,
          overrideAccess: true,
          req,
        }),
      ),
    )
    createdVotes.push(...results)
  }

  return [...existingVotes.docs, ...createdVotes]
}

export const updateGroupedVotes = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  try {
    const body = req.json ? await req.json() : null
    if (!body) return Response.json({ error: 'Invalid request format' }, { status: 400 })

    const { meetingId, votesData, companyIds } = body

    if (!meetingId) {
      return Response.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    await req.payload.update({
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingId } }, { company: { in: companyIds } }],
      },
      data: {
        reported: votesData.reported,
      },
    })

    if (votesData.fundsWithHolding?.length) {
      // Get current meeting and merge fundsWithHolding
      const currentMeeting = await req.payload.findByID({
        collection: 'meetings',
        id: meetingId,
        select: { fundsWithHolding: true },
      })

      const existingFundsWithHolding = currentMeeting?.fundsWithHolding || []

      const merged = existingFundsWithHolding.map((existingFund: any) => {
        const matchingFund = votesData.fundsWithHolding.find(
          (vote: any) => vote.fund === existingFund.fund,
        )
        return matchingFund ? { ...existingFund, ...matchingFund } : existingFund
      })

      const updatedfundsWithHolding = await req.payload.update({
        collection: 'meetings',
        id: meetingId,
        data: { fundsWithHolding: merged },
      })
      console.log('!updated', updatedfundsWithHolding)
    }

    return Response.json({ success: true }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}
