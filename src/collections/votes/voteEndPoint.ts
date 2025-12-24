import { UserVote, VoteDataType } from '@/app/(frontend)/types/vote'
import { addDataAndFileToRequest, PayloadRequest, TypedUser } from 'payload'
import { addDays } from '@/utils/dateUtils'
import { createAdminNotification } from '@/utils/utils'
import { Meeting } from '@/payload-types'

import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'
import { getUserCompanyIds } from '@/utils/authUtils'
import {
  getGroupedVotesUrl,
  groupVotesByParentAndChecksum,
  createCompanyToParentMapFromVotes,
} from '@/utils/voteGrouping'

export const getVoteByMeetingAndCompanies = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  // Check if user is logged in
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }

  try {
    const { meetingId, companiesIds, status } = req.query

    if (!meetingId || !companiesIds || !status) {
      return Response.json(
        { error: 'Meeting ID, Company IDs and Status are required' },
        { status: 400 },
      )
    }
    const userCompanies: string[] = getUserCompanyIds(req.user)
    const companiesIdsArray = (companiesIds as string)
      .split(',')
      .filter((companyId) => userCompanies.includes(companyId))
    const meetingIdString = meetingId as string
    const statusString = status as string

    const isDraftOrLatest = statusString === 'draft' || statusString === 'latest'

    const existingVotes = await req.payload.find({
      collection: 'votes',
      where: {
        and: [
          { meeting: { equals: meetingIdString } },
          { company: { in: companiesIdsArray } },
          isDraftOrLatest ? {} : { _status: { equals: statusString } },
        ],
      },
      draft: isDraftOrLatest,
      sort: statusString === 'latest' ? '-updatedAt' : undefined,
      depth: 1,
      limit: companiesIdsArray.length,
    })

    if (statusString === 'latest') {
      const latestVotesByCompany = Object.values(
        existingVotes.docs.reduce(
          (acc, vote) => {
            const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
            if (companyId && !acc[companyId]) {
              acc[companyId] = vote
            }
            return acc
          },
          {} as Record<string, (typeof existingVotes.docs)[0]>,
        ),
      )
      return Response.json(latestVotesByCompany, { status: 200 })
    }

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
  // Check if user is logged in
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }

  try {
    const { meetingId, companiesIds } = req.query

    if (!meetingId || !companiesIds) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }
    const userCompanies: string[] = getUserCompanyIds(req.user)
    const companiesIdsArray = (companiesIds as string)
      .split(',')
      .filter((companyId) => userCompanies.includes(companyId))
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
  // Check if user is logged in
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }

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
  // Check if user is logged in
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }

  try {
    const body = req.json ? await req.json() : null
    if (!body) return Response.json({ error: 'Invalid request format' }, { status: 400 })

    const { meetingId, companiesIds, votingData } = body

    if (!meetingId || !companiesIds?.length) {
      return Response.json({ error: 'Meeting ID and Company IDs are required' }, { status: 400 })
    }
    const userCompanies: string[] = getUserCompanyIds(req.user)

    const votesToPublish = await req.payload.find({
      collection: 'votes',
      select: {
        id: true,
        company: true,
        checksum: true,
        parentCompany: true,
      },
      where: {
        and: [
          { meeting: { equals: meetingId } },
          {
            company: {
              in: companiesIds.filter((companyId: string) => userCompanies.includes(companyId)),
            },
          },
        ],
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

    // Get published votes to compare checksums
    const publishedVotes = await req.payload.find({
      collection: 'votes',
      select: {
        id: true,
        company: true,
        checksum: true,
        publishedchecksum: true,
        parentCompany: true,
      },
      where: {
        and: [
          { meeting: { equals: meetingId } },
          { company: { in: votesToPublish.docs.map((v) => v.company) } },
          { _status: { equals: 'published' } },
        ],
      },
      depth: 1,
      limit: votesToPublish.docs.length,
      overrideAccess: true,
    })

    // Determine which votes actually changed
    const updatedVotes = votesToPublish.docs.filter((vote) => {
      const publishedVote = publishedVotes.docs.find(
        (pv) =>
          (typeof pv.company === 'string' ? pv.company : pv.company?.id) ===
          (typeof vote.company === 'string' ? vote.company : vote.company?.id),
      )
      // Vote is considered updated if it's new or if checksum changed
      return !publishedVote || publishedVote.publishedchecksum !== vote.checksum
    })

    await Promise.all(
      votesToPublish.docs.map((vote) =>
        req.payload.update({
          collection: 'votes',
          id: vote.id,
          data: {
            _status: 'published',
            publishedchecksum: vote.checksum,
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

          // Create company to parent map from votes' parentCompany virtual field
          const companyToParentMap = createCompanyToParentMapFromVotes(votesToPublish.docs)

          // Group votes by parent company and checksum
          const groupedVotes = groupVotesByParentAndChecksum(
            votesToPublish.docs,
            companyToParentMap,
          )

          // Create a notification for each group
          for (const [groupKey, groupData] of groupedVotes) {
            const [parentCompanyId, checksum] = groupKey.split('|')
            const groupCompaniesIds = Array.from(groupData.companies)

            const message = `הצבעה חדשה פורסמה לאחר המועד הקובע עבור ${meetingName}`
            const url = getGroupedVotesUrl(meeting.id, parentCompanyId, checksum)

            // Delete any existing notifications with the same parameters
            try {
              await req.payload.delete({
                collection: 'admin-notifications',
                where: {
                  and: [
                    { message: { equals: message } },
                    { meeting: { equals: meetingId } },
                    { url: { equals: url } },
                    { relatedUser: { equals: req?.user?.id } },
                    { companies: { in: groupCompaniesIds } },
                  ],
                },
              })
            } catch (error) {
              req.payload.logger.error(
                `Error deleting admin notification: ${JSON.stringify(error)}`,
              )
            }

            // Create notification for this group
            await createAdminNotification(
              req,
              message,
              'newVoteAfterHoldingLimit',
              url,
              groupCompaniesIds,
              req?.user?.id,
              meetingId,
            )
          }
        }
      }
    } catch (error) {
      console.error('Error creating notification for published votes:', error)
    }

    // Get company names for updated votes
    const updatedCompanyNames = await Promise.all(
      updatedVotes.map(async (vote) => {
        const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
        if (!companyId) return null
        try {
          const company = await req.payload.findByID({
            collection: 'companies',
            id: companyId,
            select: { name: true },
            depth: 0,
          })
          return company?.name || null
        } catch {
          return null
        }
      }),
    )

    const validCompanyNames = updatedCompanyNames.filter((name) => name !== null)

    return Response.json(
      {
        success: true,
        totalPublished: votesToPublish.docs.length,
        actuallyUpdated: updatedVotes.length,
        updatedCompanyNames: validCompanyNames,
        message:
          votesToPublish.docs.length === 1
            ? 'פורסמה בהצלחה הצבעה אחת'
            : `פורסמו בהצלחה ${votesToPublish.docs.length} הצבעות`,
      },
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
    dynamicQuestions: votingData.dynamicQuestions || [],
  }

  const agendaVotesFormatted = votingData.userVotes.map((userVote: UserVote) => ({
    topicIndex: userVote.topicIndex,
    voteDecision: userVote.choice,
    voteReason: userVote.voteReason,
    hasConflictOfInterest: userVote.questions.hasConflictOfInterest,
    conflictOfInterestExplanation: userVote.questions.conflictOfInterestExplanation,
    isRelatedParty: userVote.questions.isRelatedParty,
    relatedPartyExplanation: userVote.questions.relatedPartyExplanation,
    isInvestmentCommittee: userVote.questions.isInvestmentCommittee,
    hasPersonalInterest: userVote.questions.hasPersonalInterest,
    personalInterestExplanation: userVote.questions.personalInterestExplanation,
  }))
  const userCompanies: string[] = getUserCompanyIds(req?.user as TypedUser)

  const existingVotes = await req.payload.find({
    collection: 'votes',
    where: {
      and: [
        { meeting: { equals: meetingId } },
        { company: { in: companiesIds.filter((companyId) => userCompanies.includes(companyId)) } },
      ],
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
  // Check if user is logged in
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }
  if (!req.user.isAdmin) {
    return Response.json({ error: 'Unauthorized: only admin is authorized' }, { status: 401 })
  }

  try {
    const body = req.json ? await req.json() : null
    if (!body) return Response.json({ error: 'Invalid request format' }, { status: 400 })

    const { meetingId, meetingName, votesData, companyIds } = body

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
        reportApproval: votesData.reportApproval,
      },
      req,
    })

    if (votesData.fundsWithHolding?.length) {
      // Check if any fund has original data
      const hasOriginalData = votesData.fundsWithHolding.some(
        (fund: any) => fund.original && Object.keys(fund.original).length > 0,
      )

      let processedFunds = votesData.fundsWithHolding

      if (hasOriginalData) {
        // Group fundsWithHolding by fund and aggregate original data
        const groupedByFund = votesData.fundsWithHolding.reduce((acc: any, fund: any) => {
          const fundId = fund.fund

          if (!acc[fundId]) {
            acc[fundId] = {
              company: fund.company,
              fund: fund.fund,
              quantity: fund.quantity || 0,
              ownedQuantity: fund.ownedQuantity || 0,
              verifiedHoldings: fund.verifiedHoldings,
              original: [],
            }
          }

          if (fund.original && fund.original.stockId) {
            // Add original data to the original array and sum quantities
            acc[fundId].original.push({
              stockId: fund.original.stockId,
              quantity: fund.original.quantity || 0,
              ownedQuantity: fund.original.ownedQuantity || 0,
              verifiedHoldings: fund.original.verifiedHoldings,
            })
            acc[fundId].quantity += fund.original.quantity || 0
          } else {
            acc[fundId] = { ...fund }
          }

          return acc
        }, {})

        // Convert back to array and clean up empty original arrays
        processedFunds = Object.values(groupedByFund).map((fund: any) => {
          return fund
        })
      }

      // Get current meeting and merge fundsWithHolding
      const currentMeeting = await req.payload.findByID({
        collection: 'meetings',
        id: meetingId,
        select: { fundsWithHolding: true },
      })

      const existingFundsWithHolding = currentMeeting?.fundsWithHolding || []

      const merged = existingFundsWithHolding.map((existingFund: any) => {
        const matchingFund = processedFunds.find((vote: any) => vote.fund === existingFund.fund)
        return matchingFund ? { ...existingFund, ...matchingFund } : existingFund
      })

      const updatedfundsWithHolding = await req.payload.update({
        collection: 'meetings',
        id: meetingId,
        data: { fundsWithHolding: merged },
        req,
      })

      // Create company-meeting-notifications for companies with unverified holdings
      try {
        // Group funds by company that have unverified holdings
        const companiesWithHoldingsGap = new Map()

        processedFunds.forEach((fund: any) => {
          if (fund.verifiedHoldings === false && fund.ownedQuantity && fund.ownedQuantity > 0) {
            if (!companiesWithHoldingsGap.has(fund.company)) {
              companiesWithHoldingsGap.set(fund.company, [])
            }
            companiesWithHoldingsGap.get(fund.company).push({
              fundName: fund.fundName,
              ownedQuantity: fund.ownedQuantity,
              quantity: fund.quantity,
            })
          }
        })

        // Create one notification per company with detailed fund information
        for (const [companyId, funds] of companiesWithHoldingsGap) {
          const fundDetails = funds
            .map(
              (fund: any) =>
                `תיק: ${fund.fundName}, ברשות: ${fund.ownedQuantity}, במערכת: ${fund.quantity}`,
            )
            .join('\n')

          const gapText = funds.length > 1 ? 'התגלו פערים' : 'התגלה פער'
          const holdingsText = funds.length > 1 ? 'החזקות שדווחו' : 'ההחזקה שדווחה'
          const authorityHoldingsText = funds.length > 1 ? 'החזקות שמופיעות' : 'החזקה שמופיעה'

          const message = `בהצבעה בפועל באסיפה ${meetingName} ${gapText} בין ${holdingsText} למערכת לבין ${authorityHoldingsText} ברשות.\n ${fundDetails}`

          await req.payload.create({
            collection: 'company-meeting-notifications',
            data: {
              message,
              notificationType: 'holdings-gap',
              company: companyId as string,
              meeting: meetingId,
            },
            req,
          })
        }
      } catch (error) {
        console.error('Error creating unverified holdings notifications:', error)
      }
    }

    return Response.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.log('!!!!err', error)

    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}
