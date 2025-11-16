import { addDataAndFileToRequest, type PayloadRequest } from 'payload'
import { Company, Stock } from '@/payload-types'
import { generateParticipationsPDF } from '@/lib/pdfGenerator'
import { generateParticipationsExcel } from '@/lib/excelGenerator'
import {
  buildFundToParentMap,
  calculateHoldingValues,
  findRelevantCompanyIds,
} from '@/utils/dataUtils'
import { TreeCompanyType } from '@/types/companies'

interface VotesQueryParams {
  companiesIds: string
  status?: string
  startDate?: string
  endDate?: string
  search?: string
  voteAgainstRecommendation?: string
  voteDifferentFromResult?: string
  foreignStocksOnly?: string
  dualMeetingsOnly?: string
}

function createErrorResponse(error: any, message: string) {
  return Response.json({ success: false, error: message, details: error }, { status: 500 })
}

function createSuccessResponse(data: any[], totalDocs: number, totalPages: number) {
  return Response.json({ data, totalItems: totalDocs, totalPages })
}

async function processVotesData(
  fundsIds: string[],
  votes: any[],
  fullMeetingsMap: Record<string, any>,
  companiesMap: Record<string, any>,
  stockMap: Record<string, any>,
  fundToParentMap: Map<string, TreeCompanyType>,
) {
  const processedData: any[] = []

  for (const vote of votes) {
    const meetingId = typeof vote.meeting === 'string' ? vote.meeting : vote.meeting?.id
    const meeting = fullMeetingsMap[meetingId]
    if (!meeting) continue

    const stockId = typeof meeting.stock === 'string' ? meeting.stock : meeting.stock?.id
    const stock: Stock = stockMap[stockId]

    const companyId = typeof vote.company === 'string' ? vote.company : vote.company?.id
    const company = companiesMap[companyId]

    const relevantFundIds = findRelevantCompanyIds(meeting.funds as string[], fundsIds)

    const fundsArray = relevantFundIds
      .map((fundId) => {
        const match = meeting?.fundsWithHolding?.find(
          (item: { fund: string }) => item.fund === fundId,
        )
        if (!match || !match.quantity) return null
        const parent = fundToParentMap.get(fundId)
        if (parent?.id != companyId) return null
        const { percentageHolding, holdingValueInMillions } = calculateHoldingValues(
          match.ownedQuantity || match.quantity,
          meeting.stockValue,
          false,
        )
        return { id: fundId, percentageHolding, holdingValueInMillions }
      })
      .filter((result) => result !== null)
    const displayVotingRecommendation =
      company?.researchDocuments?.displayVotingRecommendation === true
    const baseRecord = {
      id: vote.id,
      originalMeetingId: meeting.id,
      meetingIdPayload: meeting.id,
      corporateName: stock.longName || '',
      stockNumber: stock.stockId || '',
      stockName: stock.name || '',
      marketValue: meeting.stockMarketValue || 0,
      stockType: stock.origin ?? '',
      percentageHolding: fundsArray.reduce(
        (sum, fund) => sum + ((fund?.percentageHolding ?? 0) as number),
        0,
      ),
      holdingValueInMillions: fundsArray.reduce(
        (sum, fund) => sum + ((fund?.holdingValueInMillions ?? 0) as number),
        0,
      ),
      meetingDate: meeting.meetingDate || '',
      meetingType: meeting.type || '',
      currentCompany: {
        id: company?.id || companyId || '',
        name: company?.name || '',
      },
      displayVotingRecommendation,
      votes: [vote],
      hasVotes: true,
      agendas: (vote.votes || []).map((voteItem: any, index: number) => {
        const agendaItem = meeting.agenda?.[index] || {}
        let votingRecommendation: string | undefined =
          agendaItem.recommendation?.votingRecommendation
        let recommendationExplanation: string | undefined =
          agendaItem.recommendation?.recommendationExplanation
        if (agendaItem.exceptionalRecommendation.showExceptional) {
          const hasExceptionalCompany = agendaItem.exceptionalRecommendation.companies.some(
            (currentCompany: string | Company) => {
              if (typeof currentCompany === 'string') {
                return currentCompany === company?.id
              }
              return currentCompany.id === company?.id
            },
          )

          if (hasExceptionalCompany) {
            votingRecommendation = agendaItem.exceptionalRecommendation.votingRecommendation
            recommendationExplanation = agendaItem.exceptionalRecommendation.reasonText
          }
        }

        return {
          id: `${vote.id}_agenda_${index}`,
          topicIndex: voteItem.topicIndex ?? index + 1,
          text: agendaItem.text || voteItem.text || `פריט ${index + 1}`,
          vote: voteItem.voteDecision || null,
          voteReason: voteItem.voteReason || null,
          policyCompliance: voteItem.isInvestmentCommittee ?? null,
          conflictOfInterest: voteItem.hasConflictOfInterest ?? null,
          relatedParty: voteItem.isRelatedParty ?? null,
          personalInterest: voteItem.hasPersonalInterest ?? null,
          recommendation: {
            votingRecommendation: displayVotingRecommendation ? votingRecommendation : '',
            recommendationExplanation: displayVotingRecommendation ? recommendationExplanation : '',
          },
          result: agendaItem.result || voteItem.meetingResult || null,
          meetingResults: agendaItem.meetingResult || voteItem.meetingResult || null,
          privilegedMajority:
            agendaItem.majorityType === 'privileged' || voteItem.majorityType === 'privileged',
          simpleMajority: !(
            agendaItem.majorityType === 'privileged' || voteItem.majorityType === 'privileged'
          ),
          percentResult: agendaItem.percentResult || null,
          isRemoved: agendaItem.isRemovedFromAgenda || false,
        }
      }),
    }

    processedData.push(baseRecord)
  }

  return processedData
}

function buildWhereConditions(params: VotesQueryParams, userCompanies: string[]) {
  const {
    companiesIds,
    status,
    startDate,
    endDate,
    search,
    voteAgainstRecommendation,
    voteDifferentFromResult,
    foreignStocksOnly,
    dualMeetingsOnly,
  } = params

  const companiesIdsArray = companiesIds.split(',')
  const allowedCompanies = companiesIdsArray.filter((id) => userCompanies.includes(id))

  const whereConditions: any[] = [{ company: { in: allowedCompanies } }]

  if (status === 'published') {
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

  const searchTrim = search?.trim()
  if (searchTrim) {
    whereConditions.push({
      or: [
        { 'meeting.meetingId': { contains: searchTrim } },
        { 'meeting.stock.stockId': { contains: searchTrim } },
        { 'meeting.stock.name': { contains: searchTrim } },
        { 'meeting.stock.symbol': { contains: searchTrim } },
        { 'meeting.stock.type': { contains: searchTrim } },
        { 'meeting.stock.longName': { contains: searchTrim } },
        { 'meeting.magnaId': { contains: searchTrim } },
        { 'meeting.type': { contains: searchTrim } },
        { 'meeting.location': { contains: searchTrim } },
        { 'meeting.comments': { contains: searchTrim } },
        { 'meeting.agenda.text': { contains: searchTrim } },
        { 'company.name': { contains: searchTrim } },
      ],
    })
  }

  if (voteAgainstRecommendation) {
    whereConditions.push({ voteAgainstRecommendation: { equals: true } })
  }

  if (voteDifferentFromResult) {
    whereConditions.push({ voteDifferentFromResult: { equals: true } })
  }

  if (foreignStocksOnly) {
    whereConditions.push({ 'meeting.stock.origin': { equals: 'Foreign' } })
  }

  if (dualMeetingsOnly) {
    whereConditions.push({ 'meeting.isDualStock': { equals: true } })
  }

  return whereConditions
}

async function fetchVotesInBatches(req: PayloadRequest, whereConditions: any[], batchSize = 500) {
  let allVotes: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const batch = await req.payload.find({
      collection: 'votes',
      where: { and: whereConditions },
      depth: 0,
      select: {
        id: true,
        meeting: true,
        company: true,
        votes: true,
      },
      sort: 'meeting.meetingDate',
      limit: batchSize,
      page,
      overrideAccess: true,
    })

    allVotes = allVotes.concat(batch.docs)
    hasMore = batch.hasNextPage
    page++

    // Add progress logging for large exports
    if (allVotes.length % 5000 === 0) {
      console.log(`Processed ${allVotes.length} votes...`)
    }
  }

  return allVotes
}

async function fetchAndProcessVotesData(
  fundsIds: string[],
  req: PayloadRequest,
  params: VotesQueryParams,
  isExport: boolean,
) {
  const { user } = req
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const companyTree = JSON.parse(user?.treeCompanies || '[]')

  const fundToParentMap = new Map<string, TreeCompanyType>()
  buildFundToParentMap(companyTree, fundToParentMap)

  const userCompanyIds = user.companies?.map((c) => c.companyId as string) || []
  const whereConditions = buildWhereConditions(params, userCompanyIds)

  if (isExport) {
    const votes = await fetchVotesInBatches(req, whereConditions)
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

    const fullMeetings = await req.payload.find({
      select: {
        id: true,
        meetingId: true,
        agenda: true,
        companies: true,
        funds: true,
        stock: true,
        stockMarketValue: true,
        holdingsLimit: true,
        type: true,
        meetingDate: true,
        recommendation: true,
        magnaId: true,
        researchDocuments: true,
        location: true,
        proxyVotingDate: true,
        state: true,
        comments: true,
        electronicVotingEnabled: true,
        resultsConfirmationStatus: true,
        committeeInitiated: true,
        fundsWithHolding: true,
        stockValue: true,
        invitationLink: true,
        votes: true,
      },
      collection: 'meetings',
      where: { id: { in: uniqueMeetingIds } },
      depth: 1,
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
        //TODO: add select
      }),
      req.payload.find({
        collection: 'companies',
        where: { id: { in: uniqueCompanyIds } },
        depth: 0,
        limit: 0,
        overrideAccess: true,
        //TODO: add select
      }),
    ])

    const fullMeetingsMap = Object.fromEntries(
      fullMeetings.docs.map((meeting: any) => [meeting.id, meeting]),
    )
    const companiesMap = Object.fromEntries(
      companiesResult.docs.map((company: any) => [company.id, company]),
    )
    const stockMap = Object.fromEntries(stocksResult.docs.map((stock: any) => [stock.id, stock]))

    return await processVotesData(
      fundsIds,
      votes,
      fullMeetingsMap,
      companiesMap,
      stockMap,
      fundToParentMap,
    )
  } else {
    const page = parseInt((req.query.page as string) || '1')
    const pageSize = parseInt((req.query.pageSize as string) || '50')

    const totalResult = await req.payload.find({
      collection: 'votes',
      where: { and: whereConditions },
      select: {
        id: true,
        meeting: true,
      },
      limit: 0,
      overrideAccess: true,
    })
    const totalItems = totalResult.totalDocs

    const votesResult = await req.payload.find({
      collection: 'votes',
      where: { and: whereConditions },
      depth: 0,
      select: {
        id: true,
        meeting: true,
        company: true,
        votes: true,
      },
      sort: 'meeting.meetingDate',
      limit: pageSize,
      page: page,
      overrideAccess: true,
    })
    const votes = votesResult.docs

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

    const fullMeetings = await req.payload.find({
      select: {
        id: true,
        meetingId: true,
        agenda: true,
        companies: true,
        funds: true,
        stock: true,
        stockMarketValue: true,
        holdingsLimit: true,
        type: true,
        meetingDate: true,
        recommendation: true,
        magnaId: true,
        researchDocuments: true,
        location: true,
        proxyVotingDate: true,
        state: true,
        comments: true,
        electronicVotingEnabled: true,
        resultsConfirmationStatus: true,
        committeeInitiated: true,
        fundsWithHolding: true,
        stockValue: true,
        invitationLink: true,
        votes: true,
      },
      collection: 'meetings',
      where: { id: { in: uniqueMeetingIds } },
      depth: 1,
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

    const fullMeetingsMap = Object.fromEntries(
      fullMeetings.docs.map((meeting: any) => [meeting.id, meeting]),
    )
    const companiesMap = Object.fromEntries(
      companiesResult.docs.map((company: any) => [company.id, company]),
    )
    const stockMap = Object.fromEntries(stocksResult.docs.map((stock: any) => [stock.id, stock]))

    const processedData = await processVotesData(
      fundsIds,
      votes,
      fullMeetingsMap,
      companiesMap,
      stockMap,
      fundToParentMap,
    )

    return { processedData, totalItems }
  }
}

export const getVotesByCompanies = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  if (!req.user) {
    return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
  }

  try {
    const {
      fundIds: fundIdsParams,
      companiesIds,
      status,
      startDate,
      endDate,
      page: pageParam,
      pageSize: pageSizeParam,
      search: searchParam,
      voteAgainstRecommendation: voteAgainstParam,
      voteDifferentFromResult: voteDifferentParam,
      foreignStocksOnly: foreignStocksOnlyParam,
      dualMeetingsOnly: dualMeetingsOnlyParam,
      export: exportParam,
      exportFormat: exportFormatParam,
      reportName: reportNameParam,
    } = req.query

    if (!companiesIds) {
      return Response.json({ error: 'Company IDs are required' }, { status: 400 })
    }

    const fundsIds = fundIdsParams ? (fundIdsParams as string).split(',') : []
    const page = parseInt((pageParam as string) || '1')
    const pageSize = parseInt((pageSizeParam as string) || '50')
    const isExport = exportParam === 'true'
    const exportFormat = (exportFormatParam as string) || 'pdf'
    const reportName = (reportNameParam as string) || 'participation-report'

    const queryParams: VotesQueryParams = {
      companiesIds: companiesIds as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: searchParam as string,
      voteAgainstRecommendation: voteAgainstParam as string,
      voteDifferentFromResult: voteDifferentParam as string,
      foreignStocksOnly: foreignStocksOnlyParam as string,
      dualMeetingsOnly: dualMeetingsOnlyParam as string,
    }

    const result = await fetchAndProcessVotesData(fundsIds, req, queryParams, isExport)

    let processedData: any[]
    let totalItems: number

    if (isExport) {
      processedData = result as any[]
      totalItems = processedData.length
    } else {
      ;({ processedData, totalItems } = result as { processedData: unknown[]; totalItems: number })
    }

    if (isExport && totalItems > 10000) {
      return Response.json(
        {
          error: 'Export too large; apply filters or contact support',
          totalItems,
          maxAllowed: 10000,
        },
        { status: 400 },
      )
    }

    if (isExport) {
      const exportOptions = {
        reportName,
        dateRange: {
          startDate: startDate ? new Date(startDate as string) : new Date(),
          endDate: endDate ? new Date(endDate as string) : new Date(),
        },
        selectedCompaniesCount: (companiesIds as string).split(',').length,
        totalRecords: processedData.length,
        selectedRecords: processedData.length,
      }

      const encodedFilename = encodeURIComponent(reportName).replace(/'/g, '%27')
      const extension = exportFormat === 'excel' ? 'xlsx' : 'pdf'
      const contentDisposition = `attachment; filename*=UTF-8''${encodedFilename}.${extension}`

      if (exportFormat === 'excel') {
        const excelBuffer = await generateParticipationsExcel(processedData, exportOptions)
        const excelUint8Array = new Uint8Array(excelBuffer)
        return new Response(excelUint8Array, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': contentDisposition,
            'Content-Length': excelUint8Array.length.toString(),
          },
        })
      } else {
        const pdfBytes = await generateParticipationsPDF(processedData, exportOptions)
        const pdfUint8Array = new Uint8Array(pdfBytes)
        return new Response(pdfUint8Array, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': contentDisposition,
            'Content-Length': pdfUint8Array.length.toString(),
          },
        })
      }
    }

    const totalPages = Math.ceil(totalItems / pageSize)
    return createSuccessResponse(processedData, totalItems, totalPages)
  } catch (error: unknown) {
    return createErrorResponse(error, 'Failed to fetch votes')
  }
}
