import { UserVote } from '@/app/(frontend)/types/vote'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'

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
        and: [{ meeting: { equals: meetingIdString } }, { company: { in: companiesIdsArray } }],
      },
      draft: statusString == 'draft',
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
  votingData: any
}) => {
  const generalFields = {
    isInterested: votingData.generalVotingData.isInterested,
    interestedExplanation: votingData.generalVotingData.interestedExplanation,
    isSeniorOfficial: votingData.generalVotingData.isSeniorOfficial,
    seniorOfficialExplanation: votingData.generalVotingData.seniorOfficialExplanation,
    isInstitutionalInvestor: votingData.generalVotingData.isInstitutionalInvestor,
    clientComment: votingData.voterNotes,
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
