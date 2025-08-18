import { type PayloadRequest, addDataAndFileToRequest } from 'payload'
import { Stock } from '@/payload-types'
import { generateParticipationsPDF } from '@/lib/pdfGenerator'
import { generateParticipationsExcel } from '@/lib/excelGenerator'

// Shared interfaces for both endpoints
interface VotesQueryParams {
  companiesIds: string
  status?: string
  startDate?: string
  endDate?: string
  sortField?: string
  sortDirection?: string
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

// Shared function to build where conditions
function buildWhereConditions(params: VotesQueryParams) {
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
  const whereConditions: any[] = [{ company: { in: companiesIdsArray } }]

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

// Shared function to fetch and process votes data
async function fetchAndProcessVotesData(req: PayloadRequest, params: VotesQueryParams) {
  const whereConditions = buildWhereConditions(params)

  // Fetch votes
  const results = await req.payload.find({
    collection: 'votes',
    where: { and: whereConditions },
    depth: 1,
    limit: 0,
    overrideAccess: true,
  })

  const votes = results.docs

  // Get unique IDs for related data
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

  // Fetch related data
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

  // Create maps for efficient lookup
  const fullMeetingsMap = Object.fromEntries(
    fullMeetings.docs.map((meeting: any) => [meeting.id, meeting]),
  )
  const companiesMap = Object.fromEntries(
    companiesResult.docs.map((company: any) => [company.id, company]),
  )
  const stockMap = Object.fromEntries(stocksResult.docs.map((stock: any) => [stock.id, stock]))

  // Process and return data
  return processVotesData(votes, fullMeetingsMap, companiesMap, stockMap)
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
      export: exportParam,
      exportFormat: exportFormatParam,
      reportName: reportNameParam,
    } = req.query

    if (!companiesIds) {
      return Response.json({ error: 'Company IDs are required' }, { status: 400 })
    }

    const page = parseInt((pageParam as string) || '1')
    const pageSize = parseInt((pageSizeParam as string) || '50')
    const sortField = (sortFieldParam as string) || 'meetingDate'
    const sortDirection = (sortDirectionParam as string) || 'desc'
    const isExport = exportParam === 'true'
    const exportFormat = (exportFormatParam as string) || 'pdf'
    const reportName = (reportNameParam as string) || 'participation-report'

    // Build query parameters
    const queryParams: VotesQueryParams = {
      companiesIds: companiesIds as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      sortField,
      sortDirection,
      search: searchParam as string,
      voteAgainstRecommendation: voteAgainstParam as string,
      voteDifferentFromResult: voteDifferentParam as string,
      foreignStocksOnly: foreignStocksOnlyParam as string,
      dualMeetingsOnly: dualMeetingsOnlyParam as string,
    }

    // Fetch and process data using shared function
    let processedData = await fetchAndProcessVotesData(req, queryParams)

    const totalItems = processedData.length
    const totalPages = Math.ceil(totalItems / pageSize)

    // Apply sorting
    processedData = applySorting(processedData, sortField, sortDirection)

    // If export mode, generate file based on format
    if (isExport) {
      const exportOptions = {
        reportName,
        dateRange: {
          startDate: startDate ? new Date(startDate as string) : new Date(),
          endDate: endDate ? new Date(endDate as string) : new Date(),
        },
        selectedCompaniesCount: (companiesIds as string).split(',').length,
        totalRecords: totalItems,
        selectedRecords: totalItems,
      }

      // Encode filename for Hebrew characters in HTTP headers
      const encodedFilename = encodeURIComponent(reportName)

      if (exportFormat === 'excel') {
        // Generate Excel file
        const excelBuffer = await generateParticipationsExcel(processedData, exportOptions)

        // Use RFC 5987 format for non-ASCII filenames with fallback
        const contentDisposition = /[^\x00-\x7F]/.test(reportName)
          ? `attachment; filename*=UTF-8''${encodedFilename}.xlsx; filename="report.xlsx"`
          : `attachment; filename="${reportName}.xlsx"`

        return new Response(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': contentDisposition,
            'Content-Length': excelBuffer.length.toString(),
          },
        })
      } else {
        // Generate PDF file (default)
        const pdfBytes = await generateParticipationsPDF(processedData, exportOptions)

        // Use RFC 5987 format for non-ASCII filenames with fallback
        const contentDisposition = /[^\x00-\x7F]/.test(reportName)
          ? `attachment; filename*=UTF-8''${encodedFilename}.pdf; filename="report.pdf"`
          : `attachment; filename="${reportName}.pdf"`

        return new Response(pdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': contentDisposition,
            'Content-Length': pdfBytes.length.toString(),
          },
        })
      }
    }

    // Regular pagination for non-export requests
    const paginated = processedData.slice((page - 1) * pageSize, page * pageSize)
    return createSuccessResponse(paginated, totalItems, totalPages)
  } catch (error: any) {
    return createErrorResponse(error, 'Failed to fetch votes')
  }
}
