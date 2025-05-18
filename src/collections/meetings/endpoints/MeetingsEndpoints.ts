import { PayloadRequest } from 'payload'
import { Meeting, MeetingAgenda, StockValue } from '@/payload-types'
import { calculateHoldingValues } from '@/app/(frontend)/helpers/utils-data-table'
import { MeetingTableDataType } from '@/app/(frontend)/types/meetings'
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
  magnaId: true,
  location: true,
  proxyVotingDate: true,
  state: true,
  comments: true,
  electronicVotingEnabled: true,
  resultsConfirmationStatus: true,
  committeeInitiated: true,
  companiesWithHolding: true,
  StockValues: true,
}

/**
 * Creates a companies filter condition based on user's leaf companies
 */
function createCompaniesFilter(userLeafCompanies: any) {
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
function getSafeLeafCompanies(userLeafCompanies: any) {
  return userLeafCompanies?.map((company: any) =>
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
function createSuccessResponse(data: any[], totalDocs: number, totalPages: number) {
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
    const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies, payload)

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
    const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies, payload)
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
 * Finds stock values for a given stock on a specific date
 */
async function findStockValues(payload: any, stockId: string, holdingsLimit: string): Promise<any> {
  const { docs: resuStockValues } = await payload.find({
    collection: 'stock-values',
    depth: 1,
    where: {
      and: [{ stockId: { equals: stockId } }, { valueDate: { less_than_equal: holdingsLimit } }],
    },
    limit: 1,
    sort: '-valueDate',
  })
  return resuStockValues.length > 0 ? resuStockValues[0] : null
}

/**
 * Creates a standardized meeting data object for the frontend
 */
function createMeetingDataObject(
  meeting: Meeting,
  stockPresent: any,
  stockValues: any,
  agendas: any,
  companiesArray: any[],
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
    marketValue: stockValues?.marketValue || 0,
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
      id: item.id,
      text: item.text || ['אסיפה ללא נושא'],
      isRemovedFromAgenda: item.isRemovedFromAgenda || false,
      privilegedMajority: item?.majorityType == 'privileged' || false,
      recommendation: item.recommendation,
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
  leafCompanies?: string[] | null,
  payload?: any,
) {
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

      let stockValues: StockValue
      const stockIdToUse = stockPresent?.relatedStock
        ? (stockPresent?.relatedStock as { id: string }).id
        : stockPresent?.id

      // Finding stockValues:
      const now = new Date()
      const isHoldingsLimitInFuture = new Date(meeting.holdingsLimit as string) > now
      if (
        !isHoldingsLimitInFuture &&
        meeting.stockValues &&
        typeof meeting.stockValues !== 'string'
      ) {
        stockValues = meeting.stockValues
      } else {
        stockValues = await findStockValues(payload, stockIdToUse, meeting.holdingsLimit as string)
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
          if (!isHoldingsLimitInFuture && meeting.companiesWithHolding?.length) {
            const match = meeting.companiesWithHolding.find((item) => {
              return typeof item.company === 'object' && item.company?.id == companyId
            })
            if (match && typeof match.holding === 'object') {
              company = match.company
              quantity = match.holding?.quantity
            } else {
              console.error(`Company ${companyId} does not exist in the companiesWithHolding array`)
            }
          } else {
            const { docs: companyHoldings } = await payload.find({
              collection: 'holdings',
              select: {
                company: true,
                quantity: true,
              },
              depth: 1,
              where: {
                and: [
                  { stock: { equals: stockIdToUse } },
                  { company: { equals: companyId } },
                  { valueDate: { less_than_equal: meeting.holdingsLimit } },
                ],
              },
              limit: 1,
              sort: '-valueDate',
            })

            if (companyHoldings.length === 0) {
              console.log(
                ` --- Error! Could not find holdings for company ID ${companyId} for stock ${stockIdToUse} on holdingsLimit date ${meeting.holdingsLimit}`,
              )
              return null
            }

            company = companyHoldings[0].company
            quantity = companyHoldings[0].quantity
          }
          // Calculate values for this company's holdings
          const { holdingsCompanyName, percentageHolding, holdingValueInMillions, nominalValue } =
            calculateHoldingValues(company, quantity, stockValues)

          return {
            holdingsCompanyName,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
          }
        }),
      ).then((results) => results.filter((result) => result !== null))

      const agendas = processAgendaItems(meeting.agenda as MeetingAgenda)

      return createMeetingDataObject(meeting, stockPresent, stockValues, agendas, companiesArray)
    }),
  )

  // Filter out null values
  return meetingData.filter((item) => item !== null)
}
