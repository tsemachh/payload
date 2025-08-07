import { type PayloadRequest, addDataAndFileToRequest } from 'payload'
import { performance } from 'perf_hooks'
import { Company, Meeting, Stock } from '@/payload-types'

function createErrorResponse(error: any, message: string) {
  return Response.json({ success: false, error: message, details: error }, { status: 500 })
}

function createSuccessResponse(data: any[], totalDocs: number, totalPages: number) {
  return Response.json({ data, totalItems: totalDocs, totalPages })
}

function processVotesData(
  votes: any[],
  fullMeetingsMap: Record<string, any>,
  companiesMap: Record<string, any>,
  stockMap: Record<string, any>,
) {
  const processedData: any[] = []

  votes.forEach((vote: any) => {
    const meetingId = typeof vote.meeting === 'string' ? vote.meeting : vote.meeting?.id
    const meeting = fullMeetingsMap[meetingId]
    const stock: Stock = stockMap[meeting.stock]

    if (!meeting) {
      console.warn('Missing full meeting for vote:', vote.id)
      return
    }

    const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
    const company = companiesMap[companyId]

    const baseRecord = {
      id: vote.id,
      originalMeetingId: meeting.id,
      meetingIdPayload: meeting.id,
      stockNumber: stock.stockId || '',
      stockName: stock.name || '',
      marketValue: meeting.stockMarketValue || 0,
      stockType: stock.origin ?? '',
      percentageHolding: meeting.percentageHolding || 0,
      holdingValueInMillions: meeting.holdingValueInMillions || 0,
      meetingDate: meeting.meetingDate || '',
      meetingType: meeting.type || '',
      currentCompany: {
        id: company?.id || companyId || '',
        name: company?.name || '',
      },
      votes: [vote],
      hasVotes: true,
      agendas: (vote.votes || []).map((voteItem: any, index: number) => {
        const agendaItem = meeting.agenda?.[index] || {}

        return {
          id: `${vote.id}_agenda_${index}`,
          topicIndex: voteItem.topicIndex ?? index + 1,
          text: agendaItem.text || voteItem.text || `פריט ${index + 1}`,
          vote: voteItem.voteDecision || null,
          policyCompliance: voteItem.isInvestmentCommittee ?? null,
          conflictOfInterest: voteItem.hasConflictOfInterest ?? null,
          relatedParty: voteItem.isRelatedParty ?? null,
          personalInterest: voteItem.hasPersonalInterest ?? null,
          recommendation: {
            votingRecommendation: agendaItem.recommendation?.votingRecommendation || '',
            recommendationExplanation: agendaItem.recommendation?.recommendationExplanation || '',
          },
          result: agendaItem.result || voteItem.meetingResult || null,
          meetingResults: agendaItem.meetingResult || voteItem.meetingResult || null,
          privilegedMajority:
            agendaItem.majorityType === 'privileged'
              ? true
              : voteItem.majorityType === 'privileged'
                ? true
                : false,
          vPercentSpecial: agendaItem.vPercentSpecial || null,
        }
      }),
    }

    processedData.push(baseRecord)
  })

  return processedData
}

function applySorting(data: any[], sortField: string, sortDirection: string) {
  return data.sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (sortField === 'meetingDate') {
      aVal = new Date(aVal).getTime()
      bVal = new Date(bVal).getTime()
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1
  })
}

export const getVotesByCompanies = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)

  try {
    const {
      companiesIds,
      status,
      startDate,
      endDate,
      page: pageParam,
      pageSize: pageSizeParam,
      sortField: sortFieldParam,
      sortDirection: sortDirectionParam,
      search: searchParam,
      voteAgainstRecommendation: voteAgainstParam,
      voteDifferentFromResult: voteDifferentParam,
      foreignStocksOnly: foreignStocksOnlyParam,
      dualMeetingsOnly: dualMeetingsOnlyParam,
    } = req.query

    if (!companiesIds) {
      return Response.json({ error: 'Company IDs are required' }, { status: 400 })
    }

    const page = parseInt((pageParam as string) || '1')
    const pageSize = parseInt((pageSizeParam as string) || '50')
    const sortField = (sortFieldParam as string) || 'meetingDate'
    const sortDirection = (sortDirectionParam as string) || 'desc'
    const searchTerm = ((searchParam as string) || '').trim()
    const voteAgainstRecommendation = voteAgainstParam === 'true'
    const voteDifferentFromResult = voteDifferentParam === 'true'
    const foreignStocksOnly = foreignStocksOnlyParam === 'true'
    const dualMeetingsOnly = dualMeetingsOnlyParam === 'true'
    const companiesIdsArray = (companiesIds as string).split(',')
    const statusString = status as string | undefined

    const whereConditions: any[] = [{ company: { in: companiesIdsArray } }]

    if (statusString === 'published') {
      whereConditions.push({ _status: { equals: 'published' } })
    }

    if (startDate && endDate) {
      whereConditions.push({
        'meeting.meetingDate': {
          greater_than_equal: startDate,
          less_than_equal: endDate,
        },
      })
    }

    if (searchTerm) {
      whereConditions.push({
        or: [
          { 'meeting.meetingId': { contains: searchTerm } },
          { 'meeting.stock.stockId': { contains: searchTerm } },
          { 'meeting.stock.name': { contains: searchTerm } },
          { 'meeting.stock.symbol': { contains: searchTerm } },
          { 'meeting.stock.type': { contains: searchTerm } },
          { 'meeting.magnaId': { contains: searchTerm } },
          { 'meeting.type': { contains: searchTerm } },
          { 'meeting.location': { contains: searchTerm } },
          { 'meeting.comments': { contains: searchTerm } },
          { 'meeting.agenda.text': { contains: searchTerm } },
          { 'company.name': { contains: searchTerm } },
        ],
      })
    }

    if (voteAgainstRecommendation) {
      whereConditions.push({
        voteAgainstRecommendation: { equals: true },
      })
    }

    if (voteDifferentFromResult) {
      whereConditions.push({
        voteDifferentFromResult: { equals: true },
      })
    }

    if (foreignStocksOnly) {
      whereConditions.push({
        'meeting.stock.origin': { equals: 'Foreign' },
      })
    }
    if (dualMeetingsOnly) {
      whereConditions.push({
        'meeting.dual': { equals: true },
      })
    }
    const results = await req.payload.find({
      collection: 'votes',
      where: { and: whereConditions },
      depth: 1,
      limit: 0,
      overrideAccess: true,
    })
    const votesQueryEndTime = performance.now()

    const votes = results.docs

    const uniqueMeetingIds = Array.from(
      new Set(
        votes
          .map((vote: any) => (typeof vote.meeting === 'string' ? vote.meeting : vote.meeting?.id))
          .filter(Boolean),
      ),
    )

    const uniqueCompanyIds = Array.from(
      new Set(
        votes
          .map((vote: any) => (typeof vote.company === 'string' ? vote.company : vote.company?.id))
          .filter(Boolean),
      ),
    )

    // שלב שני – מקביל: meetings + companies
    const parallelQueriesStartTime = performance.now()
    const fullMeetings = await req.payload.find({
      collection: 'meetings',
      where: { id: { in: uniqueMeetingIds } },
      depth: 0,
      limit: 0,
      overrideAccess: true,
    })
    const uniqueStockIds = Array.from(
      new Set(
        fullMeetings.docs
          .map((meeting: any) =>
            typeof meeting.stock === 'string' ? meeting.stock : meeting.stock?.id,
          )
          .filter(Boolean),
      ),
    )
    const [stocksResult, companiesResult] = await Promise.all([
      req.payload.find({
        collection: 'stocks',
        where: { id: { in: uniqueStockIds } },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),
      req.payload.find({
        collection: 'companies',
        where: { id: { in: uniqueCompanyIds } },
        depth: 0,
        limit: 0,
        overrideAccess: true,
      }),
    ])
    const parallelQueriesEndTime = performance.now()

    const fullMeetingsMap = Object.fromEntries(
      fullMeetings.docs.map((meeting: any) => [meeting.id, meeting]),
    )

    const companiesMap = Object.fromEntries(
      companiesResult.docs.map((company: any) => [company.id, company]),
    )

    const stockMap = Object.fromEntries(stocksResult.docs.map((stock: any) => [stock.id, stock]))

    let processedData = processVotesData(votes, fullMeetingsMap, companiesMap, stockMap)

    const totalItems = processedData.length
    const totalPages = Math.ceil(totalItems / pageSize)

    processedData = applySorting(processedData, sortField, sortDirection)

    const paginated = processedData.slice((page - 1) * pageSize, page * pageSize)

    return createSuccessResponse(paginated, totalItems, totalPages)
  } catch (error: any) {
    console.error('❌ Error in getVotesByCompanies:', error)
    return createErrorResponse(error, 'Failed to fetch votes')
  }
}
