import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { Company, Meeting, StockValue } from '@/payload-types'
import { getDbFieldName } from '@/app/(frontend)/meetings/sortFieldMapping'
import { headers as getHeaders } from 'next/headers.js'
import { calculateHoldingValues } from '../../helpers/utils-data-table'
import { MeetingTableDataType } from '../../types/meetings'

/**
 * GET API endpoint to handle paginated, sorted and filtered meetings
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25')
    const sortField = url.searchParams.get('sortField') || 'meetingDate'
    const sortDirection = url.searchParams.get('sortDirection') || 'desc'
    const searchTerm = (url.searchParams.get('search') || '').trim()
    const futureMeetingsOnly = url.searchParams.get('futureMeetingsOnly') === 'true'

    // Handle future meetings - directly fetch all and filter client-side
    if (futureMeetingsOnly) {
      const { data, totalItems } = await fetchFutureMeetings()
      return NextResponse.json({
        data,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      })
    }

    // Normal paginated meetings flow
    const result = await fetchMeetings({
      page,
      pageSize,
      sortField,
      sortDirection,
      searchTerm,
    })

    return NextResponse.json({
      data: result.data,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Error in /api/meetings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Fetch meetings with pagination, sorting and filtering
 */
async function fetchMeetings({
  page = 1,
  pageSize = 25,
  sortField = 'meetingDate',
  sortDirection = 'desc',
  searchTerm = '',
}: {
  page: number
  pageSize: number
  sortField: string
  sortDirection: string
  searchTerm: string
}) {
  // Initialize payload
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const dbSortField = getDbFieldName(sortField)
  const sort = sortDirection === 'desc' ? `-${dbSortField}` : dbSortField

  const query: any = {
    collection: 'meetings',
    select: {
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
    },
    limit: pageSize,
    page: page,
    sort: sort,
    where: {
      and: [
        user?.leafCompanies
          ? {
              companies: {
                in: user.leafCompanies,
              },
            }
          : {
              companies: {
                in: [], // no matches if user.leafCompanies is missing or empty
              },
            },
        {
          _status: {
            equals: 'published',
          },
        },
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
  const safeLeafCompanies = user?.leafCompanies?.map((company) =>
    typeof company === 'string' ? company : (company as Company).id,
  )

  // Process results to standardized format
  const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies)

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
    totalPages: meetings.totalPages,
  }
}

/**
 * Fetch future meetings (all loaded at once for client-side filtering)
 */
export async function fetchFutureMeetings(): Promise<{
  data: MeetingTableDataType[]
  totalItems: number
}> {
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const meetings = await payload.find({
    collection: 'meetings',
    select: {
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
    },
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
        user?.leafCompanies
          ? {
              companies: {
                in: user.leafCompanies,
              },
            }
          : {
              companies: {
                in: [], // no matches if user.leafCompanies is missing or empty
              },
            },
        {
          _status: {
            equals: 'published',
          },
        },
      ],
    },
  })
  const safeLeafCompanies = user?.leafCompanies?.map((company) =>
    typeof company === 'string' ? company : (company as Company).id,
  )

  // Process results to standardized format
  const meetingData = await processMeetingsData(meetings.docs, safeLeafCompanies)

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
  }
}

/**
 * Process meetings data to standardized format for frontend table
 */
async function processMeetingsData(meetings: any[], leafCompanies?: string[] | null) {
  const payload = await getPayload({ config })

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

      let stockValues: StockValue | null = null
      const stockIdToUse = stockPresent?.relatedStock
        ? (stockPresent?.relatedStock as { id: string }).id
        : stockPresent?.id

      // Finding Date: holdingsLimit date or the closest date before it.
      const { docs } = await payload.find({
        collection: 'holdings',
        select: {
          valueDate: true,
        },
        depth: 0,
        where: {
          and: [
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
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

      const nearestHoldingsLimitDate = docs.length > 0 ? docs[0].valueDate : null

      if (!nearestHoldingsLimitDate) {
        console.log(' --- Error! nearestHoldingsLimitDate not find for stockId', stockIdToUse)
        return null
      }

      // Finding stockValues:
      const { docs: resuStockValues } = await payload.find({
        collection: 'stock-values',
        depth: 1,
        where: {
          stockId: { equals: stockIdToUse },
          valueDate: { equals: new Date(nearestHoldingsLimitDate) },
        },
        limit: 0,
      })

      stockValues = resuStockValues.length > 0 ? resuStockValues[0] : null

      // Find the intersection of meeting companies and user's leaf companies
      const relevantCompanyIds = (meeting.companies || [])
        .filter((companyID) => leafCompanies?.some((leafCompany) => leafCompany === companyID))
        .filter((id) => id !== null) as string[]

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

      const agendas = meeting.agenda?.map((item) => {
        return {
          id: item.id,
          text: item.text || ['אסיפה ללא נושא'],
          isRemovedFromAgenda: item.isRemovedFromAgenda || false,
          privilegedMajority: item?.majorityType == 'privileged' || false,
          recommendation: item.recommendation,
        }
      })

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
    }),
  )

  // Filter out null values
  return meetingData.filter((item) => item !== null)
}
