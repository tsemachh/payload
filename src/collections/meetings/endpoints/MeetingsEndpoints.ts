import { PayloadRequest } from 'payload'
import { Meeting, MeetingAgenda } from '@/payload-types'
import { calculateHoldingValues } from '@/app/(frontend)/helpers/utils-data-table'
import { MeetingTableDataType } from '@/app/(frontend)/types/meetings'
import { SelectType } from 'payload'
// Response is available globally from lib.dom.d.ts

/**
 * Common select fields for meetings queries
 */
const MEETING_SELECT_FIELDS:SelectType = {
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
    const page = parseInt(req.query.page as string || '1')
    const pageSize = parseInt(req.query.pageSize as string || '25')
    const sortField = req.query.sortField as string || 'meetingDate'
    const sortDirection = req.query.sortDirection as string || 'desc'
    const searchTerm = (req.query.search as string || '').trim()

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
    const pageSize = parseInt(req.query.pageSize as string || '25')
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
  leafCompanies: string[] | null | undefined
): string[] {
  return (meetingCompanies || [])
    .filter((companyID) => leafCompanies?.some((leafCompany) => leafCompany === companyID))
    .filter((id) => id !== null) as string[]
}

/**
 * Finds stock values for a given stock on a specific date
 */
async function findStockValues(
  payload: any,
  stockId: string,
  valueDate: string | Date
): Promise<any> {
  const { docs: resuStockValues } = await payload.find({
    collection: 'stock-values',
    depth: 1,
    where: {
      stockId: { equals: stockId },
      valueDate: { equals: new Date(valueDate) },
    },
    limit: 0,
  })

  return resuStockValues.length > 0 ? resuStockValues[0] : null
}

/**
 * Finds the nearest holdings limit date before or equal to the given date
 */
async function findNearestHoldingsLimitDate(
  payload: any,
  holdingsLimit: Date | string | null,
  leafCompanies?: string[] | null
): Promise<string | null> {
  const { docs } = await payload.find({
    collection: 'holdings',
    select: {
      valueDate: true,
    },
    depth: 0,
    where: {
      and: [
        { valueDate: { less_than_equal: holdingsLimit } },
        leafCompanies?.length
          ? {
              company: {
                in: leafCompanies,
              },
            }
          : {
              company: {
                in: [],
              },
            },
      ],
    },
    sort: '-valueDate',
    limit: 1,
  })

  return docs.length > 0 ? docs[0].valueDate : null
}

/**
 * Creates a standardized meeting data object for the frontend
 */
function createMeetingDataObject(
  meeting: Meeting,
  stockPresent: any,
  stockValues: any,
  agendas: any,
  companiesArray: any[]
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
    percentageHolding:
      companiesArray?.reduce((acc, obj) => acc + obj.percentageHolding, 0) || 0,
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
async function processMeetingsData(meetings: any[], leafCompanies?: string[] | null, payload?: any) {
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

      let stockValues: any = null
      const stockIdToUse = stockPresent?.relatedStock
        ? (stockPresent?.relatedStock as { id: string }).id
        : stockPresent?.id

      // Finding Date: holdingsLimit date or the closest date before it.
      const nearestHoldingsLimitDate = await findNearestHoldingsLimitDate(
        payload,
        meeting.holdingsLimit as string,
        leafCompanies
      )

      if (!nearestHoldingsLimitDate) {
        console.log(' --- Error! nearestHoldingsLimitDate not find for stockId', stockIdToUse)
        return null
      }

      // Finding stockValues:
      stockValues = await findStockValues(payload, stockIdToUse, nearestHoldingsLimitDate)

      // Find the intersection of meeting companies and user's leaf companies
      const relevantCompanyIds = findRelevantCompanyIds(meeting.companies as string[], leafCompanies)

      // For each relevant company, find holdings and calculate values separately
      const companiesArray = await Promise.all(
        relevantCompanyIds.map(async (companyId) => {
          // For this specific company, find the nearest holdings date
          const { docs: holdingsDateDocs } = await payload.find({
            collection: 'holdings',
            select: { valueDate: true },
            depth: 0,
            where: {
              and: [
                { valueDate: { less_than_equal: meeting.holdingsLimit } },
                { company: { equals: companyId } },
              ],
            },
            sort: '-valueDate',
            limit: 1,
          })

          const nearestHoldingsLimitDate =
            holdingsDateDocs.length > 0 ? holdingsDateDocs[0].valueDate : null

          if (!nearestHoldingsLimitDate) {
            console.log(
              ` --- Error! Could not find holdings date for company ID ${companyId} for meeting ${meeting.meetingId}`,
            )
            return null
          }

          // Get this company's holdings for this date
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
                { valueDate: { equals: new Date(nearestHoldingsLimitDate) } },
              ],
            },
            limit: 1,
          })

          if (companyHoldings.length === 0) {
            console.log(
              ` --- Error! Could not find holdings for company ID ${companyId} for stock ${stockIdToUse} on date ${nearestHoldingsLimitDate}`,
            )
            return null
          }

          const company = companyHoldings[0].company
          const quantity = companyHoldings[0].quantity

          // Calculate values for this company's holdings
          const { holdingsCompanyName, percentageHolding, holdingValueInMillions, nominalValue } =
            calculateHoldingValues(company, quantity, stockValues)

          return {
            holdingsCompanyName,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
            holdingsDate: nearestHoldingsLimitDate, // Optional: include the specific date used for this company
          }
        }),
      ).then((results) => results.filter((result) => result !== null))

      const agendas = processAgendaItems(meeting.agenda as MeetingAgenda)

      return createMeetingDataObject(
        meeting,
        stockPresent,
        stockValues,
        agendas,
        companiesArray
      )
    }),
  )

  // Filter out null values
  return meetingData.filter((item) => item !== null)
}
