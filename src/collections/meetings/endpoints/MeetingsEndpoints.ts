import { addDataAndFileToRequest, PayloadRequest, SelectType, User } from 'payload'
import { Company, Meeting, MeetingAgenda, ResearchDocument, Stock } from '@/payload-types'
import {
  AgendasType,
  CompanyTableDate,
  DateFilterType,
  FundType,
  MeetingTableDataType,
  UrlFilenameMap,
} from '@/app/(frontend)/types/meetings'
import { TreeCompanyType } from '@/types/companies'
import { findSubCompanyNameById, getIdOfRelationField } from '@/utils/utils'
import {
  buildFundToParentMap,
  calculateHoldingValues,
  findRelevantCompanyIds,
} from '@/utils/dataUtils' // Response is available globally from lib.dom.d.ts
import { downloadMeetingsExcel } from '@/lib/meetingsExcelGenerator'
// Response is available globally from lib.dom.d.ts

/**
 * Common select fields for meetings queries
 */
const MEETING_SELECT_FIELDS: SelectType = {
  id: true,
  primaryLegacyId: true,
  agenda: true,
  labels: true,
  companies: true,
  funds: true,
  stock: true,
  holdingsLimit: true,
  type: true,
  meetingDate: true,
  recommendation: true,
  magnaId: true,
  researchDocuments: true,
  location: true,
  proxyVotingDate: true,
  state: true,
  isDualStock: true,
  comments: true,
  electronicVotingEnabled: true,
  resultsConfirmationStatus: true,
  committeeInitiated: true,
  fundsWithHolding: true,
  stockValue: true,
  stockMarketValue: true,
  invitationLink: true,
  votes: true,
  hasRelatedStocks: true,
}

/**
 * Creates a companies filter condition based on user's leaf companies and selected companies
 */
function createAllMeetingsCompaniesFilter(companiesIds: string[] | null | undefined) {
  if (!companiesIds || companiesIds.length === 0) {
    return { companies: { in: [] } }
  }
  return { companies: { in: companiesIds } }
}
function createCompaniesFilter(
  userCompany: (string | Company)[] | undefined | null | any,
  companiesIds: string[] | null | any,
) {
  let companies = userCompany?.map((c: any) => c?.companyId)
  if (!companiesIds || companiesIds.length === 0) {
    console.log('No companies selected → returning empty filter')
    return {
      companies: { in: [] },
    }
  }
  if (companiesIds) {
    companies = companies?.filter((com: any) => companiesIds.includes(com as string))
  }
  return userCompany
    ? {
        companies: {
          in: companies,
        },
      }
    : {
        companies: {
          in: [], // no matches if user.funds is missing or empty
        },
      }
}
function createFundsFilter(
  userFunds: (string | Company)[] | undefined | null,
  fundIds: string[] | null = null,
) {
  let funds = userFunds?.map(getIdOfRelationField)
  if (fundIds) {
    funds = funds?.filter((fund) => fundIds.includes(fund as string))
  }
  return userFunds
    ? {
        funds: {
          in: funds,
        },
      }
    : {
        funds: {
          in: [], // no matches if user.funds is missing or empty
        },
      }
}
/**
 * Creates a published status filter condition
 */
function createPublishedStatusFilter() {
  return {
    _status: {
      equals: 'published',
    },
  }
}

/**
 * Creates filter conditions from regular filters
 */
function createRegularFilters(filters: Record<string, string[]>) {
  const conditions: any[] = []

  Object.entries(filters).forEach(([field, values]) => {
    if (values && values.length > 0) {
      // Map frontend field names to database field names
      const dbField = getDbFieldName(field)
      //handle fromRelatedStock filter
      if (field === 'meetingState') {
        conditions.push({
          state: { in: values },
        })
      } else if (field === 'stockType') {
        conditions.push({
          'stock.type': { in: values },
        })
      } else if (field === 'stockOrigin') {
        conditions.push({
          'stock.origin': { in: values },
        })
      } else if (field === 'meetingType') {
        conditions.push({
          type: { in: values.length ? values : [null] },
        })
      } else if (field === 'isDualStock') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            isDualStock: { equals: true },
          })
          conditions.push({
            isDualStock: { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        const booleanValue = booleanValues.length === 1 ? booleanValues[0] : booleanValues
        console.log('!!!!! isDualStock filter values: ', values, booleanValue)
        conditions.push({
          isDualStock: { equals: booleanValue },
        })
      } else if (field === 'electronicVotingEnabled') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            electronicVotingEnabled: { equals: true },
          })
          conditions.push({
            electronicVotingEnabled: { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          electronicVotingEnabled: { in: booleanValues },
        })
      } else if (field === 'fromRelatedStock') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            fromRelatedStock: { equals: true },
          })
          conditions.push({
            fromRelatedStock: { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          fromRelatedStock: { in: booleanValues },
        })
      } else if (field === 'resultsConfirmationStatus') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            resultsConfirmationStatus: { equals: true },
          })
          conditions.push({
            resultsConfirmationStatus: { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          resultsConfirmationStatus: { in: booleanValues },
        })
      } else if (field === 'stockTradable') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            'stock.tradable': { equals: true },
          })
          conditions.push({
            'stock.tradable': { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          'stock.tradable': { in: booleanValues },
        })
      } else if (field === 'committeeInitiated') {
        if (values[0] == 'noOptionSelect') {
          conditions.push({
            'stock.isFinancial': { equals: true },
          })
          conditions.push({
            'stock.isFinancial': { equals: false },
          })
        }
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          'stock.isFinancial': { in: booleanValues },
        })
      } else {
        // Generic field filter
        conditions.push({
          [dbField]: { in: values },
        })
      }
    }
  })

  return conditions
}

/**
 * Creates date filter conditions
 */
function createDateFilters(dateFilters: Record<string, DateFilterType>) {
  const conditions: any[] = []

  Object.entries(dateFilters).forEach(([field, filter]) => {
    const { empty, custom, customDate } = filter

    // Skip if all options are selected (no actual filtering)
    if (empty && !custom) {
      return
    }

    const dbField = getDbFieldName(field)
    const dateConditions: any[] = []

    // Handle empty dates
    if (!empty && dateConditions.length > 0) {
      // If empty is false and we have other date conditions, exclude null/empty dates
      dateConditions.forEach((condition) => {
        // Add not null condition to existing date conditions
        if (condition[dbField]) {
          condition[dbField] = {
            ...condition[dbField],
            not_equals: null,
          }
        }
      })
    } else if (empty && dateConditions.length === 0) {
      // If only empty is selected and no other date conditions
      dateConditions.push({
        or: [{ [dbField]: { equals: null } }, { [dbField]: { equals: '' } }],
      })
    } else if (empty && dateConditions.length > 0) {
      // If empty is selected along with other date conditions, include empty dates in OR
      dateConditions.push({
        or: [{ [dbField]: { equals: null } }, { [dbField]: { equals: '' } }],
      })
    }

    if (custom && customDate.startDate && customDate.endDate) {
      dateConditions.push({
        [dbField]: {
          greater_than_equal: customDate.startDate,
          less_than_equal: customDate.endDate,
        },
      })
    }

    if (dateConditions.length > 0) {
      if (dateConditions.length === 1) {
        conditions.push(dateConditions[0])
      } else {
        conditions.push({
          or: dateConditions,
        })
      }
    }
  })
  return conditions
}

/**
 * Converts user's leaf companies to a safe format
 */
function getSafeFunds(userFunds: (string | Company)[] | undefined | null) {
  return userFunds?.map((company: string | Company) =>
    typeof company === 'string' ? company : company.id,
  )
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(error: any, message: string) {
  return Response.json(
    {
      success: false,
      error: message,
      details: error,
    },
    { status: 500 },
  )
}

/**
 * Creates a standardized success response
 */
function createSuccessResponse(
  data: MeetingTableDataType[],
  totalDocs: number,
  totalPages: number,
) {
  return Response.json({
    data,
    totalItems: totalDocs,
    totalPages,
  })
}
/** * Endpoint to fetch all meetings */
export const allMeetingsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload

    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const { user } = req

    // Get query parameters
    const page = parseInt((req.query.page as string) || '1')
    const pageSize = parseInt((req.query.pageSize as string) || '50')
    const sortField = (req.query.sortField as string) || 'meetingDate'
    const sortDirection = (req.query.sortDirection as string) || 'desc'
    const searchTerm = ((req.query.search as string) || '').trim()
    const selectedFundsParam = req.query.funds as string

    // NEW: Get vote filter parameters
    const voteAgainstRecommendation = req.query.voteAgainstRecommendation === 'true'
    const voteDifferentFromResult = req.query.voteDifferentFromResult === 'true'
    const companyIdsParam = req.query.companyIds as string
    let companyIds: string[] | undefined
    if (companyIdsParam && companyIdsParam.trim() !== '') {
      try {
        companyIds = JSON.parse(companyIdsParam)
      } catch (e) {
        companyIds = companyIdsParam.split(',').map((id: string) => id.trim())
      }
    } else {
      companyIds = []
    }
    let frontendSelectedFundIds: string[] | undefined
    if (selectedFundsParam) {
      frontendSelectedFundIds = selectedFundsParam.split(',')
    }
    // Parse filters from query parameters
    const filters: Record<string, string[]> = {}
    const dateFilters: Record<string, DateFilterType> = {}

    Object.keys(req.query).forEach((key) => {
      if (key.startsWith('filter_')) {
        const fieldName = key.replace('filter_', '')
        try {
          filters[fieldName] = JSON.parse(req.query[key] as string)
        } catch (e) {
          console.warn(`Failed to parse filter for ${fieldName}:`, e)
        }
      } else if (key.startsWith('dateFilter_')) {
        const fieldName = key.replace('dateFilter_', '')
        try {
          dateFilters[fieldName] = JSON.parse(req.query[key] as string)
        } catch (e) {
          console.warn(`Failed to parse date filter for ${fieldName}:`, e)
        }
      }
    })

    // Determine sort field
    const dbSortField = getDbFieldName(sortField)
    const sort = sortDirection === 'desc' ? `-${dbSortField}` : dbSortField

    // Build filter conditions
    const whereConditions: any[] = [createFundsFilter(user?.funds), createPublishedStatusFilter()]
    const userFunds = getSafeFunds(user?.funds)
    if (userFunds && userFunds.length > 0) {
      whereConditions.push(createFundsFilter(userFunds))
    } else {
      // If user has no funds, they shouldn't see any meetings
      whereConditions.push({ funds: { in: [] } })
    }

    // Apply frontend selected funds filter (further restriction)
    if (frontendSelectedFundIds && frontendSelectedFundIds.length > 0) {
      whereConditions.push(createFundsFilter(frontendSelectedFundIds))
    }
    if (companyIds) {
      whereConditions.push(createAllMeetingsCompaniesFilter(companyIds))
    }
    // Add search condition
    if (searchTerm) {
      whereConditions.push({
        or: [
          { primaryLegacyId: { contains: searchTerm } },
          { 'stock.stockId': { contains: searchTerm } },
          { 'stock.name': { contains: searchTerm } },
          { 'stock.symbol': { contains: searchTerm } },
          { 'stock.type': { contains: searchTerm } },
          { magnaId: { contains: searchTerm } },
          { type: { contains: searchTerm } },
          { comments: { contains: searchTerm } },
          { 'agenda.text': { contains: searchTerm } },
        ],
      })
    }

    // Add regular filters
    const regularFilterConditions = createRegularFilters(filters)
    whereConditions.push(...regularFilterConditions)

    // Add date filters
    const dateFilterConditions = createDateFilters(dateFilters)
    whereConditions.push(...dateFilterConditions)

    const query: any = {
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      limit: pageSize,
      page: page,
      sort: sort,
      where: {
        and: whereConditions.filter((condition) => Object.keys(condition).length > 0),
      },
    }

    // Execute query
    const meetings = await payload.find(query)
    const safeFunds = getSafeFunds(user?.funds)

    // Process results to standardized format
    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User, req)

    return createSuccessResponse(
      meetingData.filter((item): item is MeetingTableDataType => item !== null),
      meetings.totalDocs,
      meetings.totalPages,
    )
  } catch (error) {
    req.payload.logger.error(`Error in allMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch meetings')
  }
}

/**
 * Endpoint to fetch future meetings
 */
// meetingColumnsForServer.ts
export const meetingColumnsForServer = [
  { key: 'agendas', header: 'סדר היום' },
  { key: 'companies', header: 'חברות' },
  { key: 'agenda', header: 'סדר יום' },
  { key: 'labels', header: 'תגית' },
  { key: 'stockNumber', header: 'מס׳ נייר' },
  { key: 'stockType', header: 'סוג נייר' },
  { key: 'stockName', header: 'שם נייר' },
  { key: 'companyName', header: 'שם תאגיד' },
  { key: 'stockSymbol', header: 'סימול' },
  { key: 'stockTradable', header: 'נייר ערך נסחר' },
  { key: 'stockOrigin', header: 'מקור נייר' },
  { key: 'marketValue', header: 'שווי שוק \n (מיליוני ₪)' },
  { key: 'meetingType', header: 'סוג אסיפה' },
  { key: 'meetingDate', header: 'מועד אסיפה' },
  { key: 'holdingsLimit', header: 'מועד קובע' },
  { key: 'proxyVotingDate', header: 'מועד מסירת הצבעות' },
  { key: 'nominalValue', header: 'ערך נקוב ליום קובע' },
  { key: 'percentageHolding', header: 'החזקה (%)' },
  { key: 'holdingValueInMillions', header: 'שווי החזקה  (מיליוני ₪)' },
  { key: 'reference', header: 'אסמכתא' },
  { key: 'meetingState', header: 'מצב' },
  { key: 'isDualStock', header: 'דואלית' },
  { key: 'researchDocuments', header: 'מחקר' },
  { key: 'location', header: 'מיקום' },
  { key: 'comments', header: 'הערות' },
  { key: 'resultsConfirmationStatus', header: 'אימות תוצאות' },
  { key: 'electronicVotingEnabled', header: 'מופיעה במערכת האלק׳' },
  { key: 'committeeInitiated', header: 'תאגיד פיננסי דורש ועדה' },
  { key: 'reported', header: 'הצבעה בפועל' },
]

export const futureMeetingsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload

    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const { user } = req
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Extract companyIds from query parameters
    const companyIdsParam = req.query.companyIds as string
    const selectedCompaniesIds = companyIdsParam ? companyIdsParam.split(',') : null
    const meetings = await payload.find({
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      depth: 1,
      limit: 0,
      where: {
        and: [
          { state: { in: ['scheduled', 'ongoing', 'postponed', 'on-hold'] } },
          { meetingDate: { greater_than_equal: todayISO } },
          createCompaniesFilter(user?.companies, selectedCompaniesIds),
          createPublishedStatusFilter(),
        ],
      },
    })
    const safeFunds = getSafeFunds(user?.funds)

    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User)
    const pageSize = parseInt((req.query.pageSize as string) || '50')
    const totalPages = Math.ceil(meetings.totalDocs / pageSize)
    if (req.query.export === 'true') {
      const columns = req.query.columns ? JSON.parse(req.query.columns as string) : []
      const headerMap: Record<string, string> = {}
      meetingColumnsForServer.forEach((col) => {
        headerMap[col.key] = col.header
      })

      const mappedColumns = columns.map((colKey: string) => headerMap[colKey] || colKey)
      const viewMode = req.query.viewMode || ''
      const buffer = await downloadMeetingsExcel(meetingData, mappedColumns, viewMode as string)

      const encodedFilename = encodeURIComponent('דו׳׳ח אסיפות')
      const contentDisposition = `attachment; filename*=UTF-8''${encodedFilename}.xlsx;`

      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': contentDisposition,
          'Content-Length': buffer.length.toString(), // שינוי פה!
        },
      })
    }
    return createSuccessResponse(
      meetingData.filter((item): item is MeetingTableDataType => item !== null),
      meetings.totalDocs,
      totalPages,
    )
  } catch (error) {
    req.payload.logger.error(`Error in futureMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch future meetings')
  }
}

/**
 * Creates a standardized meeting data object for the frontend
 */
function createMeetingDataObject(
  meeting: Meeting,
  stockPresent: Stock,
  agendas: AgendasType[],
  companiesArray: CompanyTableDate[],
  researchDocuments: UrlFilenameMap[],
  displayVotingRecommendation: boolean,
  defaultVotingRecommendation: boolean,
): MeetingTableDataType {
  return {
    meetingIdPayload: meeting.id,
    meetingId: meeting.primaryLegacyId || '' || '',
    agendas,
    labels: (meeting.labels || []).filter(
      (label): label is { id: string; label: string; color: string } =>
        !!label?.id && !!label?.label && !!label?.color,
    ),
    votingPercentage: null, // mean have no data yet.
    displayVotingRecommendation,
    defaultVotingRecommendation,
    companies: companiesArray,
    stockNumber: stockPresent?.stockId?.toString() || '-',
    stockType: stockPresent?.type || '-',
    stockSymbol: stockPresent?.symbol || '-',
    stockName: stockPresent?.name || '-',
    companyName: stockPresent?.longName || '-',
    stockTradable: stockPresent?.tradable || false,
    stockOrigin: stockPresent?.origin || '-',
    marketValue: meeting.stockMarketValue || 0,
    meetingType: meeting.type || '-',
    meetingDate: meeting.meetingDate || '-',
    reference: meeting.magnaId || '-',
    researchDocuments,
    location: meeting.location || '-',
    holdingsLimit: meeting.holdingsLimit || '-',
    proxyVotingDate: meeting.proxyVotingDate || '-',
    nominalValue: companiesArray?.reduce((acc, obj) => acc + obj.nominalValue, 0) || 0,
    percentageHolding: companiesArray?.reduce((acc, obj) => acc + obj.percentageHolding, 0) || 0,
    holdingValueInMillions:
      companiesArray?.reduce((acc, obj) => acc + obj.holdingValueInMillions, 0) || 0,
    meetingState: meeting.state || null,
    isDualStock: !!meeting?.isDualStock,
    meetingInviteUrl: meeting.invitationLink || '',
    comments: meeting.comments || '-',
    electronicVotingEnabled: !!meeting.electronicVotingEnabled,
    resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
    committeeInitiated: !!stockPresent.isFinancial,
    votes: meeting.votes || [],
    fromRelatedStock: meeting.hasRelatedStocks || false,
  }
}

/**
 * Process agenda items to a standardized format
 */
function processAgendaItems(agenda: MeetingAgenda | undefined) {
  return agenda?.map((item, index) => {
    return {
      id: item.id || '',
      topicIndex: index + 1, // Ensure topicIndex starts from 1
      text: item.text || 'אסיפה ללא נושא',
      isRemovedFromAgenda: item.isRemovedFromAgenda || false,
      privilegedMajority: item?.majorityType == 'privileged' || false,
      recommendation: {
        votingRecommendation: item.recommendation?.votingRecommendation || '',
        recommendationExplanation: item.recommendation?.reasonText || '',
      },
      result: item.result || '',
      percentResult: typeof item.percentResult === 'number' ? item.percentResult : null,
    }
  })
}

/**
 * Helper function to map sort fields
 */
function getDbFieldName(clientField: string): string {
  const fieldMap: Record<string, string> = {
    stockNumber: 'stock.stockId',
    stockSymbol: 'stock.symbol',
    stockName: 'stock.name',
    companyName: 'stock.longName',
    meetingType: 'type',
    reference: 'magnaId',
    // Add other mappings as needed
  }

  return fieldMap[clientField] || clientField
}

/**
 * Process meetings data to standardized format for frontend table
 */
async function processMeetingsData(
  meetings: any[],
  funds?: string[] | null,
  user?: User | null,
  req?: PayloadRequest,
): Promise<(MeetingTableDataType | null)[]> {
  const companyTree = JSON.parse(user?.treeCompanies || '[]')

  // Create a map between fundId and parent company structure from the companyTree
  const fundToParentMap = new Map<string, TreeCompanyType>()

  // Build the map
  buildFundToParentMap(companyTree, fundToParentMap)

  // Process results
  const meetingData = await Promise.all(
    meetings.map(async (_meeting) => {
      const meeting: Meeting = _meeting as Meeting
      let stockPresent = null
      if (typeof meeting.stock === 'object') stockPresent = meeting.stock

      // If stockNumber is undefined, log a message and skip this item
      if (!stockPresent?.stockId) {
        console.error(
          `Emda Error:\nSkipping meeting with ID: "${meeting.primaryLegacyId}": stockNumber is missing`,
        )
        return null
      }

      // Find the intersection of meeting companies and user's leaf companies
      const relevantFundIds = findRelevantCompanyIds(meeting.funds as string[], funds)

      // For each relevant fund, find holdings and calculate values separately
      const fundsArray = await Promise.all(
        relevantFundIds.map(async (fundId) => {
          let quantity
          // Get this company's holdings for this date
          const match = meeting?.fundsWithHolding?.find((item) => {
            return item.fund && (item.fund as string) == fundId
          })
          if (match && match.fund) {
            if (match?.ownedQuantity) {
              quantity = match.ownedQuantity
            } else if (match.quantity) {
              quantity = match.quantity
            } else {
              console.error(
                `Company ${fundId} does not exist or is not valid in the fundsWithHolding array`,
              )
              return null
            }
          } else {
            console.error(
              `Company ${fundId} does not exist or is not valid in the fundsWithHolding array`,
            )
            return null
          }
          // Calculate values for this company's holdings
          const { percentageHolding, holdingValueInMillions, nominalValue } =
            calculateHoldingValues(quantity, meeting.stockValue)
          const parentCompany = fundToParentMap.get(fundId as string)
          const holdingsCompanyName = findSubCompanyNameById(parentCompany, fundId)
          const originalStockIds = match.original?.map((o) => {
            return { stockId: o.stockId, quantity: o.quantity }
          })
          return {
            id: fundId,
            holdingsCompanyName,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
            parentCompany,
            originalStockIds,
            fromRelatedStock: match.fromRelatedStock,
          }
        }),
      ).then((results) => results.filter((result) => result !== null))

      const parentCompaniesMap = new Map<
        string,
        { parentCompany: string | TreeCompanyType; funds: FundType[] }
      >()
      // Process each fund to find its parent and group them
      for (const fund of fundsArray) {
        // If no parent found, skip this fund or treat the fund itself as parent
        const parentCompany = fundToParentMap.get(fund.id)
        if (!parentCompany) {
          console.warn(`No parent company found for fund ${fund.id}`)
          continue
        }
        const parentCompanyID = parentCompany.id

        const tmpFund: FundType = {
          id: fund.id,
          holdingsCompanyName: fund.holdingsCompanyName || ' ',
          percentageHolding: fund.percentageHolding,
          holdingValueInMillions: fund.holdingValueInMillions,
          nominalValue: fund.nominalValue,
          parentCompany: parentCompany,
          originalStockIds: fund.originalStockIds,
          fromRelatedStock: fund.fromRelatedStock || false,
        }
        if (parentCompaniesMap.has(parentCompanyID)) {
          parentCompaniesMap.get(parentCompanyID)!.funds.push(tmpFund)
        } else {
          parentCompaniesMap.set(parentCompanyID, {
            parentCompany: parentCompany,
            funds: [tmpFund],
          })
        }
      }

      // Create the final companiesArray
      const companiesArray: CompanyTableDate[] = Array.from(parentCompaniesMap.values()).map(
        ({ parentCompany, funds }) => {
          // Calculate aggregated values for the parent company
          const totalPercentageHolding = funds.reduce((sum, fund) => {
            const originalFund = fundsArray.find((f) => f.id === fund.id)
            return sum + (originalFund?.percentageHolding || 0)
          }, 0)

          const totalHoldingValueInMillions = funds.reduce((sum, fund) => {
            const originalFund = fundsArray.find((f) => f.id === fund.id)
            return sum + (originalFund?.holdingValueInMillions || 0)
          }, 0)

          const totalNominalValue = funds.reduce((sum, fund) => {
            const originalFund = fundsArray.find((f) => f.id === fund.id)
            return sum + (originalFund?.nominalValue || 0)
          }, 0)

          const originalStockIds = [
            ...new Set(funds.flatMap((fund) => fund.originalStockIds || [])),
          ]
          const fromRelatedStock = funds.some((fund) => fund.fromRelatedStock)

          return {
            id: typeof parentCompany === 'string' ? parentCompany : parentCompany.id,
            percentageHolding: totalPercentageHolding,
            holdingValueInMillions: totalHoldingValueInMillions,
            nominalValue: totalNominalValue,
            originalStockIds,
            funds,
            fromRelatedStock,
          }
        },
      )

      const agendas: AgendasType[] = processAgendaItems(meeting.agenda as MeetingAgenda) || []

      const usersCompanyIds = user?.companies
        ? user.companies
            .map((c: { companyId: string }) => c.companyId)
            .filter((id: string): id is string => !!id) || []
        : []

      const commonCompanies = (meeting.companies ?? []).filter(
        (company): company is Company =>
          company != null &&
          typeof company === 'object' &&
          'id' in company &&
          usersCompanyIds.includes(String((company as Company).id)),
      )
      type PermissionKey =
        | 'showResearch'
        | 'showResearchBond'
        | 'showResearchTrusteeship'
        | 'showResearchPrivate'
      const keys: PermissionKey[] = [
        'showResearch',
        'showResearchBond',
        'showResearchTrusteeship',
        'showResearchPrivate',
      ]
      const researchPermissions = Object.fromEntries(
        keys.map((key) => [key, commonCompanies.some((c) => c.researchDocuments?.[key])]),
      ) as Record<PermissionKey, boolean>

      const researchDocuments: UrlFilenameMap[] = (meeting.researchDocuments ?? [])
        .filter(
          (doc): doc is ResearchDocument =>
            typeof doc === 'object' &&
            doc !== null &&
            'url' in doc &&
            'filename' in doc &&
            typeof doc.url === 'string' &&
            typeof doc.filename === 'string',
        )
        .filter((doc) => {
          const docCompanyIds = doc.companies ?? []
          const hasCompanies = docCompanyIds.length > 0
          const userHasAccessToDocCompanies = hasCompanies
            ? docCompanyIds.some((id) => usersCompanyIds.includes(id))
            : true
          switch (meeting.type) {
            case 'אג"ח':
              return researchPermissions.showResearchBond
            case 'אג"ח כהונת נאמן':
              return researchPermissions.showResearchTrusteeship
            default:
              return true
          }
        })
        .map((doc) => ({
          url: doc.url as string,
          filename: doc.filename as string,
          companies: doc.companies as string[],
        }))

      const displayVotingRecommendation = user?.companies.some(
        (userCompany: { companyId: string }) => {
          const companies = meeting?.companies?.filter((c): c is Company => typeof c !== 'string')
          const fullCompany = companies?.find((c) => c.id === userCompany?.companyId)
          return fullCompany?.researchDocuments?.displayVotingRecommendation === true
        },
      )
      const defaultVotingRecommendation = user?.companies.some(
        (userCompany: { companyId: string }) => {
          const companies = meeting?.companies?.filter((c): c is Company => typeof c !== 'string')
          const fullCompany = companies?.find((c) => c.id === userCompany?.companyId)
          return fullCompany?.researchDocuments?.defaultVotingRecommendation === true
        },
      )
      if (companiesArray.length === 0) {
        console.error(
          '%c--- EMDA CRITICAL ERROR! ---\nMeeting without funds. The company is invited to the meeting but fund data is missing.\nSkipping meeting with ID: ' +
            meeting.primaryLegacyId,
          'color: white; background-color: red; font-weight: bold; font-size: 14px; padding: 4px;',
        )
        req?.payload.logger.error(
          '%c--- EMDA CRITICAL ERROR! ---\nMeeting without funds. The company is invited to the meeting but fund data is missing.\nSkipping meeting with ID: ' +
            meeting.meetingId
        )
        return null
      }

      return createMeetingDataObject(
        meeting,
        stockPresent,
        agendas,
        companiesArray,
        researchDocuments,
        displayVotingRecommendation,
        defaultVotingRecommendation,
      )
    }),
  )

  // Filter out null values
  return meetingData.filter((item) => item !== null)
}

export const meetingForVotingEndPoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload

    // Check if user is logged in
    if (!req.user) {
      return Response.json({ error: 'Unauthorized: No user logged in' }, { status: 401 })
    }

    const { user } = req

    const meetingId = (req.query.meetingId as string) || '1'

    const query: any = {
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      limit: 1,
      where: {
        and: [
          {
            id: { equals: meetingId },
          },
          createFundsFilter(user?.funds),
          createPublishedStatusFilter(),
        ],
      },
    }

    // Execute query
    const meetings = await payload.find(query)
    const safeFunds = getSafeFunds(user?.funds)

    // Process results to standardized format
    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User)

    return createSuccessResponse(
      meetingData.filter((item): item is MeetingTableDataType => item !== null),
      meetings.totalDocs,
      meetings.totalPages,
    )
  } catch (error) {
    req.payload.logger.error(`Error in allMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch meetings')
  }
}
