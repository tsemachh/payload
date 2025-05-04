import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { Meeting, StockValue } from '@/payload-types'
import { getDbFieldName } from '@/app/(frontend)/meetings/sortFieldMapping'
import { headers as getHeaders } from 'next/headers.js'
import { calculateHoldingValues } from '../../helpers/utils-data-table'
import { MeetingTableDataType } from '../../types/meetings'

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '25')
    const sortField = url.searchParams.get('sortField') || 'meetingDate'
    const sortDirection = url.searchParams.get('sortDirection') || 'desc'
    const searchTerm = (url.searchParams.get('search') || '').trim()
    const dbSortField = getDbFieldName(sortField)

    // Initialize payload
    const payload = await getPayload({ config })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    const sort = sortDirection === 'desc' ? `-${dbSortField}` : dbSortField

    const query: any = {
      collection: 'meetings',
      limit: pageSize,
      page: page,
      sort: sort,
      where: {
        and: [
          user?.leafCompanies
            ? {
                companies: {
                  in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
                },
              }
            : {
                companies: {
                  in: [], // no matches if user.leafCompanies is missing or empty
                },
              },
          searchTerm
            ? {
                or: [
                  { meetingId: { contains: searchTerm } },
                  { 'stock.stockId': { contains: searchTerm } },
                  { 'stock.name': { contains: searchTerm } },
                  { 'stock.symbol': { contains: searchTerm } },
                  // { 'stock.tradable': { contains: searchTerm } },
                  // { 'stock.marketValue': { contains: searchTerm } },
                  { 'stock.type': { contains: searchTerm } },
                  { magnaId: { contains: searchTerm } },
                  { type: { contains: searchTerm } },
                  // { meetingDate: { contains: searchTerm } },
                  // { reference: { contains: searchTerm } },
                  { location: { contains: searchTerm } },
                  // { holdingsLimit: { contains: searchTerm } },
                  // { proxyVotingDate: { contains: searchTerm } },
                  // { meetingState: { contains: searchTerm } },
                  { comments: { contains: searchTerm } },
                ],
              }
            : {},
        ],
      },
    }

    // Execute query
    const meetings = await payload.find(query)

    // Process results
    const meetingData = await Promise.all(
      meetings.docs.map(async (_meeting) => {
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
        let companiesArray = null
        const stockIdToUse = stockPresent?.relatedStock
          ? (stockPresent?.relatedStock as { id: string }).id
          : stockPresent?.id
        // Finding Date: holdingsLimit date or the closest date before it.
        const { docs } = await payload.find({
          collection: 'holdings',
          depth: 0,
          where: {
            and: [
              { valueDate: { less_than_equal: meeting.holdingsLimit } },
              user?.leafCompanies
                ? {
                    company: {
                      in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
                    },
                  }
                : {
                    company: {
                      in: [], // no matches if user.leafCompanies is missing or empty
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
        } else {
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

          // Finding holdings:
          const { docs: holdingsLimitDateDocs } = await payload.find({
            collection: 'holdings',
            depth: 1,
            where: {
              and: [
                { stock: { equals: stockIdToUse } },
                { valueDate: { equals: new Date(nearestHoldingsLimitDate) } },
                user?.leafCompanies
                  ? {
                      company: {
                        in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
                      },
                    }
                  : {
                      company: {
                        in: [], // no matches if user.leafCompanies is missing or empty
                      },
                    },
              ],
            },
            limit: 0,
          })
          const resuHoldings = holdingsLimitDateDocs

          // Implementation of holdings values
          companiesArray = resuHoldings.map(({ company, quantity }) => {
            const { holdingsCompanyName, percentageHolding, holdingValueInMillions, nominalValue } =
              calculateHoldingValues(company, quantity, stockValues)
            return {
              holdingsCompanyName,
              percentageHolding,
              holdingValueInMillions,
              nominalValue,
            }
          })
        }
        return {
          meetingId: meeting.meetingId,
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
          nominalValue: companiesArray?.reduce((acc, obj) => acc + obj.nominalValue, 0),
          percentageHolding: companiesArray?.reduce((acc, obj) => acc + obj.percentageHolding, 0),
          holdingValueInMillions: companiesArray?.reduce(
            (acc, obj) => acc + obj.holdingValueInMillions,
            0,
          ),
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
    const filteredData = meetingData.filter((item) => item !== null)

    // Return response
    return NextResponse.json({
      data: filteredData,
      totalItems: meetings.totalDocs,
      totalPages: meetings.totalPages,
    })
  } catch (error) {
    console.error('Error in /api/meetings:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
