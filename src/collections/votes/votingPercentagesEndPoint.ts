import { MeetingWithCompanies } from '@/app/(frontend)/types/meetings'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'

// Reusable helper function to calculate voting percentages
export const calculateVotingPercentages = async (
  payload: any,
  meetings: MeetingWithCompanies[],
  userCompanyIds?: string[],
): Promise<{ [key: string]: { votingPercentage: number | null } }> => {
  const percentagesMap: { [key: string]: { votingPercentage: number | null } } = {}

  // Extract all valid meeting IDs and company IDs
  const validMeetings = meetings.filter((m) => m.meetingId && m.companyIds)

  if (validMeetings.length === 0) {
    return percentagesMap
  }

  const meetingIds = validMeetings.map((m) => m.meetingId)

  // Build query conditions
  const queryConditions: any[] = [
    { meeting: { in: meetingIds } },
    { _status: { equals: 'published' } },
  ]

  // Add user company filter if provided (for performance optimization)
  if (userCompanyIds && userCompanyIds.length > 0) {
    queryConditions.push({ company: { in: userCompanyIds } })
  }

  // Single query to fetch all votes for all meetings at once
  const votesQuery = await payload.find({
    collection: 'votes',
    select: { meeting: true, company: true },
    where: {
      and: queryConditions,
    },
    depth: 0,
    limit: 0, // No limit - fetch all votes
  })

  // Group votes by meeting ID
  const votesByMeeting: { [key: string]: any[] } = {}
  votesQuery.docs.forEach((vote: any) => {
    const meetingId = vote.meeting
    if (!votesByMeeting[meetingId]) {
      votesByMeeting[meetingId] = []
    }
    votesByMeeting[meetingId].push(vote)
  })

  // Calculate percentages for each meeting
  validMeetings.forEach((meetingInfo) => {
    const votes = votesByMeeting[meetingInfo.meetingId] || []
    // Filter votes by company IDs for this specific meeting
    const relevantVotes = votes.filter((vote) => {
      const companyId = vote.company
      return meetingInfo.companyIds.includes(companyId)
    })

    percentagesMap[meetingInfo.meetingId] = {
      votingPercentage: (relevantVotes.length / meetingInfo.companyIds.length) * 100,
    }
  })

  return percentagesMap
}

export const getVotingPercentages = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const body = req.json ? await req.json() : null
    if (!body || !body.meetings) {
      return Response.json({ error: 'Invalid request format' }, { status: 400 })
    }

    const { meetings } = body

    if (!Array.isArray(meetings) || meetings.length === 0) {
      return Response.json(
        { error: 'meetings array is required and cannot be empty' },
        { status: 400 },
      )
    }

    const userCompanyIds = req.user.companies?.map((c) => c.companyId as string) || []
    const percentagesMap = await calculateVotingPercentages(req.payload, meetings, userCompanyIds)

    return Response.json({ percentages: percentagesMap }, { status: 200 })
  } catch (error: any) {
    req.payload.logger.error(`Error in getVotingPercentages: ${error.message}`)
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}
