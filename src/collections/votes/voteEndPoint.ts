import { UserVote } from '@/app/(frontend)/types/vote'
import { PayloadRequest } from 'payload'
export const getVoteByMeetingAndCompanies = async (req: PayloadRequest) => {
  try {
    const { meetingId, companyIds } = req.query

    if (!meetingId || !companyIds) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }

    const companyIdsArray = (companyIds as string).split(',')
    const meetingIdString = meetingId as string

    const existingVotes = await req.payload.find({
      collection: 'votes',
      where: {
        and: [
          { meeting: { equals: meetingIdString } },
          { company: { in: companyIdsArray } },
          { _status: { equals: 'draft' } },
        ],
      },
      depth: 0,
      limit: companyIdsArray.length,
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
  try {
    let body
    if (req.json) {
      body = await req.json()
    } else {
      return Response.json({ error: 'Invalid request format' }, { status: 400 })
    }

    const { meetingId, votingData, companiesIds } = body

    if (!meetingId || !companiesIds || !Array.isArray(companiesIds) || companiesIds.length === 0) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }

    const generalFields = {
      meeting: meetingId,
      company: companiesIds[0], //TODO: this is a temporary fix, we need to change the UI to allow multiple companies
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
      if (companyId) {
        existingCompanyMap.set(companyId, vote)
      }
    })

    // create arrays for bulk operations
    const toUpdate: Array<{ id: string; data: any }> = []
    const toCreate: Array<any> = []

    companiesIds.forEach((companyId) => {
      const voteData = {
        ...generalFields,
        company: companyId,
        meetingId: meetingId,
        votes: agendaVotesFormatted,
        _status: 'draft',
      }

      if (existingCompanyMap.has(companyId)) {
        toUpdate.push({
          id: existingCompanyMap.get(companyId).id,
          data: voteData,
        })
      } else {
        toCreate.push(voteData)
      }
    })

    // bulk updates
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((updateItem) =>
          req.payload.update({
            collection: 'votes',
            id: updateItem.id,
            data: updateItem.data,
            overrideAccess: true,
          }),
        ),
      )
      req.payload.logger.info(`Updated ${toUpdate.length} companiesIds`)
    }

    // bulk creates
    if (toCreate.length > 0) {
      await Promise.all(
        toCreate.map((createData) =>
          req.payload.create({
            collection: 'votes',
            data: createData,
            overrideAccess: true,
          }),
        ),
      )
      req.payload.logger.info(`Created ${toCreate.length} new votes`)
    }

    return Response.json({ success: true }, { status: 200 })
  } catch (error: any) {
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}
