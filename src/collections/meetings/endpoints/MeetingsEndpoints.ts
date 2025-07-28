import { addDataAndFileToRequest, PayloadRequest, SelectType, User } from 'payload'
import {
  Company,
  Meeting,
  MeetingAgenda,
  ResearchDocument,
  Stock,
  StockValue,
} from '@/payload-types'
import { calculateHoldingValues } from '@/app/(frontend)/helpers/utils-data-table'
import {
  AgendasType,
  CompanyTableDate,
  DateFilterType,
  FundType,
  MeetingTableDataType,
  UrlFilenameMap,
} from '@/app/(frontend)/types/meetings'
import { TreeCompanyType } from '@/types/companies'
import { findSubCompanyNameById } from '@/utils/utils'
// Response is available globally from lib.dom.d.ts

/**
 * Common select fields for meetings queries
 */
const MEETING_SELECT_FIELDS: SelectType = {
  id: true,
  meetingId: true,
  agenda: true,
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
  comments: true,
  electronicVotingEnabled: true,
  resultsConfirmationStatus: true,
  committeeInitiated: true,
  fundsWithHolding: true,
  stockValue: true,
  invitationLink: true,
}

/**
 * Creates a companies filter condition based on user's leaf companies
 */
function createCompaniesFilter(userFunds: (string | Company)[] | undefined | null) {
  return userFunds
    ? {
        funds: {
          in: userFunds,
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

      if (field === 'meetingState') {
        conditions.push({
          state: { in: values },
        })
      } else if (field === 'stockType') {
        conditions.push({
          'stock.type': { in: values },
        })
      } else if (field === 'meetingType') {
        conditions.push({
          type: { in: values.length ? values : [null] },
        })
      } else if (field === 'electronicVotingEnabled') {
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          electronicVotingEnabled: { in: booleanValues },
        })
      } else if (field === 'resultsConfirmationStatus') {
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          resultsConfirmationStatus: { in: booleanValues },
        })
      } else if (field === 'stockTradable') {
        const booleanValues = values.map((v) => v === 'true')
        conditions.push({
          'stock.tradable': { in: booleanValues },
        })
      } else if (field === 'committeeInitiated') {
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
    const { past, future, empty, custom, customDate } = filter

    // Skip if all options are selected (no actual filtering)
    if (past === 'allPast' && future === 'allFuture' && empty && !custom) {
      return
    }

    const dbField = getDbFieldName(field)
    const dateConditions: any[] = []

    // Handle past dates
    if (past) {
      const dateRange = getDateRangeForFilter(past)
      if (dateRange) {
        dateConditions.push({
          [dbField]: {
            greater_than_equal: dateRange.start.toISOString(),
            less_than_equal: dateRange.end.toISOString(),
          },
        })
      }
    }

    // Handle future dates
    if (future) {
      const dateRange = getDateRangeForFilter(future)
      if (dateRange) {
        dateConditions.push({
          [dbField]: {
            greater_than_equal: dateRange.start.toISOString(),
            less_than_equal: dateRange.end.toISOString(),
          },
        })
      }
    }

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
 * Helper function to get date range for filter options
 */
function getDateRangeForFilter(option: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  switch (option) {
    case 'yesterday':
      return { start: yesterday, end: yesterday }
    case 'lastWeek':
      const lastWeekStart = new Date(today)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      return { start: lastWeekStart, end: yesterday }
    case 'lastMonth':
      const lastMonthStart = new Date(today)
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
      return { start: lastMonthStart, end: yesterday }
    case 'today':
      return { start: today, end: today }
    case 'nextWeek':
      const nextWeekEnd = new Date(today)
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)
      return { start: today, end: nextWeekEnd }
    case 'nextMonth':
      const nextMonthEnd = new Date(today)
      nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1)
      return { start: today, end: nextMonthEnd }
    case 'allPast':
      return { start: new Date(-8640000000000000), end: yesterday }
    case 'allFuture':
      return { start: today, end: new Date(8640000000000000) }
    default:
      return null
  }
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

/**
 * Endpoint to fetch all meetings
 */
export const allMeetingsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload
    const { user } = req

    // Get query parameters
    const page = parseInt((req.query.page as string) || '1')
    const pageSize = parseInt((req.query.pageSize as string) || '50')
    const sortField = (req.query.sortField as string) || 'meetingDate'
    const sortDirection = (req.query.sortDirection as string) || 'desc'
    const searchTerm = ((req.query.search as string) || '').trim()

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
    const whereConditions: any[] = [
      createCompaniesFilter(user?.funds),
      createPublishedStatusFilter(),
    ]

    // Add search condition
    if (searchTerm) {
      whereConditions.push({
        or: [
          { meetingId: { contains: searchTerm } },
          { 'stock.stockId': { contains: searchTerm } },
          { 'stock.name': { contains: searchTerm } },
          { 'stock.symbol': { contains: searchTerm } },
          { 'stock.type': { contains: searchTerm } },
          { magnaId: { contains: searchTerm } },
          { type: { contains: searchTerm } },
          { location: { contains: searchTerm } },
          { comments: { contains: searchTerm } },
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
    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User)

    return createSuccessResponse(meetingData, meetings.totalDocs, meetings.totalPages)
  } catch (error) {
    req.payload.logger.error(`Error in allMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch meetings')
  }
}

/**
 * Endpoint to fetch future meetings
 */
export const futureMeetingsEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    const payload = req.payload
    const { user } = req
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    const meetings = await payload.find({
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      depth: 1,
      limit: 0,
      where: {
        and: [
          { state: { in: ['scheduled', 'ongoing', 'postponed', 'on-hold'] } },
          { meetingDate: { greater_than_equal: todayISO } },
          createCompaniesFilter(user?.funds),
          createPublishedStatusFilter(),
        ],
      },
    })

    const safeFunds = getSafeFunds(user?.funds)

    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User)
    const pageSize = parseInt((req.query.pageSize as string) || '50')
    const totalPages = Math.ceil(meetings.totalDocs / pageSize)

    return createSuccessResponse(meetingData, meetings.totalDocs, totalPages)
  } catch (error) {
    req.payload.logger.error(`Error in futureMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch future meetings')
  }
}

/**
 * Finds the intersection of meeting companies and user's leaf companies
 */
function findRelevantCompanyIds(
  meetingCompanies: string[] | undefined,
  funds: string[] | null | undefined,
): string[] {
  return (meetingCompanies || [])
    .filter((companyID) => funds?.some((fund) => fund === companyID))
    .filter((id) => id !== null) as string[]
}
/**
 * Creates a standardized meeting data object for the frontend
 */
function createMeetingDataObject(
  meeting: Meeting,
  stockPresent: Stock,
  stockValue: StockValue,
  agendas: AgendasType[],
  companiesArray: CompanyTableDate[],
  researchDocuments: UrlFilenameMap[],
  displayVotingRecommendation: boolean,
  defaultVotingRecommendation: boolean,
): MeetingTableDataType {
  return {
    meetingIdPayload: meeting.id,
    meetingId: meeting.meetingId || '' || '',
    agendas,
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
    marketValue: stockValue?.marketValue || 0,
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
    meetingInviteUrl: meeting.invitationLink || '',
    comments: meeting.comments || '-',
    electronicVotingEnabled: !!meeting.electronicVotingEnabled,
    resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
    committeeInitiated: !!stockPresent.isFinancial,
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
async function processMeetingsData(meetings: any[], funds?: string[] | null, user?: User | null) {
  const companyTree = JSON.parse(user?.treeCompanies || '[]')

  // Create a map between fundId and parent company structure from the companyTree
  const fundToParentMap = new Map<string, TreeCompanyType>()

  // Function to traverse the tree and build the map
  const buildFundToParentMap = (companies: TreeCompanyType[]) => {
    for (const company of companies) {
      if (company.subCompanies && company.subCompanies.length > 0) {
        // For each subCompany, set the current company as parent
        for (const subCompany of company.subCompanies) {
          fundToParentMap.set(subCompany.id, company)
        }
        // Recursively process subCompanies
        buildFundToParentMap(company.subCompanies)
      }
    }
  }

  // Build the map
  buildFundToParentMap(companyTree)

  // Process results
  const meetingData = await Promise.all(
    meetings.map(async (_meeting) => {
      const meeting: Meeting = _meeting as Meeting
      let stockPresent = null
      if (typeof meeting.stock === 'object') stockPresent = meeting.stock

      // If stockNumber is undefined, log a message and skip this item
      if (!stockPresent?.stockId) {
        console.error(
          `Emda Error:\nSkipping meeting with ID: "${meeting.meetingId}": stockNumber is missing`,
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
          if (match && match.fund && match?.quantity) {
            quantity = match.quantity
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
          return {
            id: fundId,
            holdingsCompanyName,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
            parentCompany,
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

          return {
            id: typeof parentCompany === 'string' ? parentCompany : parentCompany.id,
            percentageHolding: totalPercentageHolding,
            holdingValueInMillions: totalHoldingValueInMillions,
            nominalValue: totalNominalValue,
            funds,
          }
        },
      )

      const agendas: AgendasType[] = processAgendaItems(meeting.agenda as MeetingAgenda) || []

      const usersCompanyIds =
        user?.companies
          .map((c: { companyId: string }) => c.companyId)
          .filter((id: string): id is string => !!id) || []

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
            typeof doc.filename === 'string' &&
            doc.url !== null &&
            doc.filename !== null,
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
              return hasCompanies ? userHasAccessToDocCompanies : researchPermissions.showResearch
          }
        })
        .map((doc) => ({
          url: doc.url as string,
          filename: doc.filename as string,
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

      return createMeetingDataObject(
        meeting,
        stockPresent,
        meeting.stockValue as StockValue,
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
          createCompaniesFilter(user?.funds),
          createPublishedStatusFilter(),
        ],
      },
    }

    // Execute query
    const meetings = await payload.find(query)
    const safeFunds = getSafeFunds(user?.funds)

    // Process results to standardized format
    const meetingData = await processMeetingsData(meetings.docs, safeFunds, user as User)

    return createSuccessResponse(meetingData, meetings.totalDocs, meetings.totalPages)
  } catch (error) {
    req.payload.logger.error(`Error in allMeetingsEndpoint: ${JSON.stringify(error)}`)
    return createErrorResponse(error, 'Failed to fetch meetings')
  }
}
