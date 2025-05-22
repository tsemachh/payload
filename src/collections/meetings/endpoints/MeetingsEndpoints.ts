import { PayloadRequest } from 'payload'
import { Company, Meeting, MeetingAgenda, Stock, StockValue } from '@/payload-types'
import { calculateHoldingValues } from '@/app/(frontend)/helpers/utils-data-table'
import {
  AgendasType,
  CompanyTableDate,
  MeetingTableDataType,
} from '@/app/(frontend)/types/meetings'
import { SelectType } from 'payload'
// Response is available globally from lib.dom.d.ts

/**
 * Common select fields for meetings queries
 */
const MEETING_SELECT_FIELDS: SelectType = {
  meetingId: true,
  agenda: true,
  companies: true,
  stock: true,
  holdingsLimit: true,
  type: true,
  meetingDate: true,
  recommendation: true,
  magnaId: true,
  location: true,
  proxyVotingDate: true,
  state: true,
  comments: true,
  electronicVotingEnabled: true,
  resultsConfirmationStatus: true,
  committeeInitiated: true,
  companiesWithHolding: true,
  stockValue: true,
}

/**
 * Creates a companies filter condition based on user's leaf companies
 */
function createCompaniesFilter(userLeafCompanies: (string | Company)[] | undefined | null) {
  return userLeafCompanies
    ? {
        companies: {
          in: userLeafCompanies,
        },
      }
    : {
        companies: {
          in: [], // no matches if user.leafCompanies is missing or empty
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
 * Converts user's leaf companies to a safe format
 */
function getSafeLeafCompanies(userLeafCompanies: (string | Company)[] | undefined | null) {
  return userLeafCompanies?.map((company: string | Company) =>
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
    const payload = req.payload
    const { user } = req

    // Get query parameters
    const page = parseInt((req.query.page as string) || '1')
    const pageSize = parseInt((req.query.pageSize as string) || '25')
    const sortField = (req.query.sortField as string) || 'meetingDate'
    const sortDirection = (req.query.sortDirection as string) || 'desc'
    const searchTerm = ((req.query.search as string) || '').trim()

    // Determine sort field
    const dbSortField = getDbFieldName(sortField)
    const sort = sortDirection === 'desc' ? `-${dbSortField}` : dbSortField

    const query: any = {
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      limit: pageSize,
      page: page,
      sort: sort,
      where: {
        and: [
          createCompaniesFilter(user?.leafCompanies),
          createPublishedStatusFilter(),
          searchTerm
            ? {
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
              }
            : {},
        ],
      },
    }

    // Execute query
    const meetings = await payload.find(query)
    const safeLeafCompanies = getSafeLeafCompanies(user?.leafCompanies)

    // Process results to standardized format
    const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies)

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
    const payload = req.payload
    const { user } = req

    const meetings = await payload.find({
      collection: 'meetings',
      select: MEETING_SELECT_FIELDS,
      depth: 1,
      limit: 0, // Get all meetings
      where: {
        and: [
          {
            or: [
              {
                meetingDate: { greater_than_equal: new Date() },
              },
              {
                meetingDate: { exists: false },
              },
            ],
          },
          createCompaniesFilter(user?.leafCompanies),
          createPublishedStatusFilter(),
        ],
      },
    })

    const safeLeafCompanies = getSafeLeafCompanies(user?.leafCompanies)

    // Process results to standardized format
    const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies)
    const pageSize = parseInt((req.query.pageSize as string) || '25')
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
  leafCompanies: string[] | null | undefined,
): string[] {
  return (meetingCompanies || [])
    .filter((companyID) => leafCompanies?.some((leafCompany) => leafCompany === companyID))
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
): MeetingTableDataType {
  return {
    meetingId: meeting.meetingId,
    agendas,
    companies: companiesArray,
    stockNumber: stockPresent?.stockId?.toString() || '-',
    stockType: stockPresent?.type || '-',
    stockSymbol: stockPresent?.symbol || '-',
    stockName: stockPresent?.name || '-',
    companyName: stockPresent?.longName || '-',
    stockTradable: stockPresent?.tradable || false,
    marketValue: stockValue?.marketValue || 0,
    meetingType: meeting.type || '-',
    meetingDate: meeting.meetingDate || '-',
    reference: meeting.magnaId || '-',
    location: meeting.location || '-',
    holdingsLimit: meeting.holdingsLimit || '-',
    proxyVotingDate: meeting.proxyVotingDate || '-',
    nominalValue: companiesArray?.reduce((acc, obj) => acc + obj.nominalValue, 0) || 0,
    percentageHolding: companiesArray?.reduce((acc, obj) => acc + obj.percentageHolding, 0) || 0,
    holdingValueInMillions:
      companiesArray?.reduce((acc, obj) => acc + obj.holdingValueInMillions, 0) || 0,
    meetingState: meeting.state || null,
    meetingInviteUrl: `https://www.magna.isa.gov.il/details?id=${meeting.magnaId}&file=0`,
    comments: meeting.comments || '-',
    electronicVotingEnabled: !!meeting.electronicVotingEnabled,
    resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
    committeeInitiated: !!meeting.committeeInitiated,
  } as MeetingTableDataType
}

/**
 * Process agenda items to a standardized format
 */
function processAgendaItems(agenda: MeetingAgenda | undefined) {
  return agenda?.map((item) => {
    return {
      id: item.id || '',
      text: item.text || 'אסיפה ללא נושא',
      isRemovedFromAgenda: item.isRemovedFromAgenda || false,
      privilegedMajority: item?.majorityType == 'privileged' || false,
      recommendation: {
        votingRecommendation: item.recommendation?.votingRecommendation || 'בעד', //TODO: Return an empty string as the default value.
        recommendationExplanation: item.recommendation?.recommendation || '',
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
async function processMeetingsData(meetings: any[], leafCompanies?: string[] | null) {
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
      const relevantCompanyIds = findRelevantCompanyIds(
        meeting.companies as string[],
        leafCompanies,
      )

      // For each relevant company, find holdings and calculate values separately
      const companiesArray = await Promise.all(
        relevantCompanyIds.map(async (companyId) => {
          let company
          let quantity
          // Get this company's holdings for this date
          const match = meeting.companiesWithHolding?.find((item) => {
            return typeof item.company === 'object' && item.company?.id == companyId
          })
          if (
            match &&
            typeof match.holding === 'object' &&
            match.company &&
            match.holding?.quantity
          ) {
            company = match.company
            quantity = match.holding?.quantity
          } else {
            console.error(
              `Company ${companyId} does not exist or is not valid in the companiesWithHolding array`,
            )
            return null
          }
          // Calculate values for this company's holdings
          const { holdingsCompanyName, percentageHolding, holdingValueInMillions, nominalValue } =
            calculateHoldingValues(company, quantity, meeting.stockValue)

          return {
            id: companyId,
            holdingsCompanyName,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
          }
        }),
      ).then((results) => results.filter((result) => result !== null))

      const agendas: AgendasType[] = processAgendaItems(meeting.agenda as MeetingAgenda) || []

      return createMeetingDataObject(
        meeting,
        stockPresent,
        meeting.stockValue as StockValue,
        agendas,
        companiesArray,
      )
    }),
  )

  // Filter out null values
  return meetingData.filter((item) => item !== null)
}
