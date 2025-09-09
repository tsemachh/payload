import { MeetingWithCompanies } from '@/app/(frontend)/types/meetings'
import { addDataAndFileToRequest, PayloadRequest } from 'payload'

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

    const percentagesMap: { [key: string]: { votingPercentage: number | null } } = {}

    await Promise.all(
      meetings.map(async (meetingInfo: MeetingWithCompanies) => {
        if (!meetingInfo.meetingId || !meetingInfo.companyIds) {
          console.warn('Skipping invalid item in meetings array:', meetingInfo)
          return
        }

        const votesQuery = await req.payload.find({
          collection: 'votes',
          where: {
            and: [
              { meeting: { equals: meetingInfo.meetingId } },
              { company: { in: meetingInfo.companyIds } },
              { _status: { equals: 'published' } },
            ],
          },
          limit: 0,
        })

        const allVotes = votesQuery.docs

        percentagesMap[meetingInfo.meetingId] = {
          votingPercentage: (allVotes.length / meetingInfo.companyIds.length) * 100,
        }
      }),
    )

    return Response.json({ percentages: percentagesMap }, { status: 200 })
  } catch (error: any) {
    req.payload.logger.error(`Error in getVotingPercentages: ${error.message}`)
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    )
  }
}
