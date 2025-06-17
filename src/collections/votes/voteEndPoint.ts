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
      interested: votingData.generalVotingData.isInterested,
      interestedExplanation: votingData.generalVotingData.interestedExplanation,
      seniorOfficial: votingData.generalVotingData.isSeniorOfficial,
      seniorOfficialExplanation: votingData.generalVotingData.seniorOfficialExplanation,
      institutionalInvestor: votingData.generalVotingData.isInstitutionalInvestor,
      clientComment: votingData.voterNotes,
      meeting: meetingId,
    }

    const agendaVotesFormatted = votingData.userVotes.map((userVote: any) => ({
      topicIndex: userVote.subjectId,
      voteDecision: userVote.choice,
      investmentCommittee: userVote.questions.isInvestmentCommittee,
      investmentCommitteeExplanation: userVote.questions.investmentCommitteeExplanation,
      relatedParty: userVote.questions.isRelatedParty,
      relatedPartyExplanation: userVote.questions.relatedPartyExplanation,
      conflictOfInterest: userVote.questions.hasConflictOfInterest,
      personalInterest: userVote.questions.hasPersonalInterest,
      personalInterestExplanation: userVote.questions.personalInterestExplanation,
    }))

    // חיפוש כל האובייקטים הקיימים בבת אחת
    const existingVotes = await req.payload.find({
      collection: 'votes',
      where: {
        and: [{ meeting: { equals: meetingId } }, { company: { in: companiesIds } }],
      },
      depth: 0,
      limit: companiesIds.length,
      overrideAccess: true,
    })

    // יצירת מפה של חברות קיימות
    const existingCompanyMap = new Map()
    existingVotes.docs.forEach((vote) => {
      const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
      if (companyId) {
        existingCompanyMap.set(companyId, vote)
      }
    })

    // הכנת arrays עבור bulk operations
    const toUpdate: Array<{ id: string; data: any }> = []
    const toCreate: Array<any> = []

    companiesIds.forEach((companyId) => {
      const voteData = {
        ...generalFields,
        company: companyId,
        votes: agendaVotesFormatted,
        _status: 'draft',
      }

      if (existingCompanyMap.has(companyId)) {
        // הוספה לרשימת עדכונים
        toUpdate.push({
          id: existingCompanyMap.get(companyId).id,
          data: voteData,
        })
      } else {
        // הוספה לרשימת יצירות
        toCreate.push(voteData)
      }
    })

    // ביצוע bulk updates
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
      req.payload.logger.info(`Updated ${toUpdate.length} existing votes`)
    }

    // ביצוע bulk creates
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
