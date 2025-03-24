import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'
import { Meeting } from '@/payload-types'
import { getDbFieldName } from '@/app/(frontend)/meetings-future/sortFieldMapping'
import { headers as getHeaders } from 'next/headers.js'

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
          {
            companies: {
              in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id), // בודק אם לפחות אחד מה-ID-ים נמצא בתוך מערך ה-companies
            },
          },
          searchTerm
            ? {
                or: [
                  { meetingId: { contains: searchTerm } },
                  { 'stock.stockId': { contains: searchTerm } },
                  { 'stock.name:': { contains: searchTerm } },
                  { 'stock.symbol:': { contains: searchTerm } },
                  { 'stock.tradable': { contains: searchTerm } },
                  { 'stock.marketValue': { contains: searchTerm } },
                  { 'stock.registeredValue': { contains: searchTerm } },
                  { 'stock.type': { contains: searchTerm } },
                  { magnaId: { contains: searchTerm } },
                  { type: { contains: searchTerm } },
                  { meetingDate: { contains: searchTerm } },
                  { reference: { contains: searchTerm } },
                  { location: { contains: searchTerm } },
                  { holdingsLimit: { contains: searchTerm } },
                  { proxyVotingDate: { contains: searchTerm } },
                  { meetingState: { contains: searchTerm } },
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

        let stocksVales = null
        if (meeting.holdingsLimit) {
          const stockIdToUse = stockPresent?.relatedStock
            ? (stockPresent?.relatedStock as { id: string }).id
            : stockPresent?.id

          const result = await payload.find({
            collection: 'stock-values',
            where: {
              stockId: { equals: stockIdToUse },
              valueDate: { equals: new Date(meeting.holdingsLimit).toISOString() },
            },
            limit: 0,
          })
          stocksVales = result.docs.length > 0 ? result.docs[0] : null
        }

        return {
          meetingId: meeting.meetingId,
          stockNumber: stockPresent?.stockId?.toString() || '-',
          stockType: stockPresent?.type || '-',
          stockSymbol: stockPresent?.symbol || '-',
          stockName: stockPresent?.name || '-',
          companyName: stockPresent?.longName || '-',
          stockTradable: stockPresent?.tradable || false,
          marketValue: stocksVales?.marketValue || 0,
          registeredValue: stocksVales?.registeredValue || 0,
          meetingType: meeting.type || '-',
          meetingDate: meeting.meetingDate || '-',
          reference: meeting.magnaId || '-',
          location: meeting.location || '-',
          holdingsLimit: meeting.holdingsLimit || '-',
          proxyVotingDate: meeting.proxyVotingDate || '-',
          meetingState: meeting.state || null,
          meetingInviteUrl: `https://www.magna.isa.gov.il/details?id=${meeting.magnaId}&file=0`,
          comments: meeting.comments || '-',
          electronicVotingEnabled: !!meeting.electronicVotingEnabled,
          resultsConfirmationStatus: !!meeting.resultsConfirmationStatus,
          committeeInitiated: !!meeting.committeeInitiated,
        }
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
