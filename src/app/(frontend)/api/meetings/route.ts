import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { MeetingTableDataType } from '@/app/(frontend)/types'
import { getDbFieldName } from '@/app/(frontend)/meetings/sortFieldMapping'
import { getDateRange } from '@/app/(frontend)/meetings/meetingTableConstants'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '25')
  const frontendSortField = searchParams.get('sortField') || 'meetingDate'
  const sortDirection = searchParams.get('sortDirection') || 'desc'
  const searchTerm = (searchParams.get('search') || '').trim()
  const filters = searchParams.get('filters') ? JSON.parse(searchParams.get('filters') || '{}') : {}
  const facetsOnly = searchParams.get('facetsOnly') === 'true'

  // Map frontend field to database field
  const dbSortField = getDbFieldName(frontendSortField)

  // Convert to payload sort format (prefix with - for descending)
  const sort = sortDirection === 'desc' ? `-${dbSortField}` : dbSortField

  try {
    const payload = await getPayload({ config })
    // Build search clause
    const searchClause = searchTerm 
      ? {
          or: [
            { meetingId: { contains: searchTerm } },
            { stock: { name: { contains: searchTerm } } },
            { stock: { stockId: { contains: searchTerm } } },
            { stock: { longName: { contains: searchTerm } } },
            { type: { contains: searchTerm } },
            { magnaId: { contains: searchTerm } },
            { location: { contains: searchTerm } },
          ]
        } 
      : {};

    // Build filter clause
    const filterClauses = [];

    // Add search clause if it exists
    if (Object.keys(searchClause).length > 0) {
      filterClauses.push(searchClause);
    }

    // Process filters
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        // Always use the mapping for all columns
        const dbKey = getDbFieldName(key);

        console.log(`Filtering ${key} using DB field ${dbKey} with values:`, value);

        // Handle boolean filters
        if (value.includes('true') || value.includes('false')) {
          const booleanValues = [];
          if (value.includes('true')) booleanValues.push(true);
          if (value.includes('false')) booleanValues.push(false);

          filterClauses.push({
            [dbKey]: {
              in: booleanValues
            }
          });
        }
        // Handle date filters - check if the key contains "מועד" or is a known date field
        else if (key.includes('מועד') || 
                key === 'meetingDate' || 
                key === 'holdingsLimit' || 
                key === 'proxyVotingDate') {

          // Process date filters with past: and future: prefixes
          const pastFilters = value.filter(v => v.startsWith('past:')).map(v => v.replace('past:', ''));
          const futureFilters = value.filter(v => v.startsWith('future:')).map(v => v.replace('future:', ''));
          const emptyFilter = value.includes('empty');

          const dateConditions = [];

          // Process past date filters
          if (pastFilters.length > 0) {
            pastFilters.forEach(pastFilter => {
              const dateRange = getDateRange(pastFilter);
              dateConditions.push({
                [dbKey]: {
                  greater_than_equal: dateRange.start.toISOString(),
                  less_than_equal: dateRange.end.toISOString()
                }
              });
            });
          }

          // Process future date filters
          if (futureFilters.length > 0) {
            futureFilters.forEach(futureFilter => {
              const dateRange = getDateRange(futureFilter);
              dateConditions.push({
                [dbKey]: {
                  greater_than_equal: dateRange.start.toISOString(),
                  less_than_equal: dateRange.end.toISOString()
                }
              });
            });
          }

          // Process empty filter
          if (emptyFilter) {
            dateConditions.push({
              [dbKey]: {
                equals: null
              }
            });
          }

          // Add date conditions to filter clauses
          if (dateConditions.length > 0) {
            filterClauses.push({
              or: dateConditions
            });
          }
        }
        // Handle regular string filters
        else {
          filterClauses.push({
            [dbKey]: {
              in: value
            }
          });
        }
      }
    });

    // Combine all clauses with AND
    const whereClause = filterClauses.length > 0 
      ? { and: filterClauses }
      : {};

    // If facetsOnly is true, return empty facet data for now
    // This is a temporary solution to improve performance
    if (facetsOnly) {
      return NextResponse.json({ facets: {} });
    }

    // Regular data query
    const meetings = await payload.find({
      collection: 'meetings',
      limit: pageSize,
      page: page,
      sort: sort,
      where: whereClause as any // Type assertion to bypass complex nested type issues
    })

    const meetingData: MeetingTableDataType[] = await (
      await Promise.all(
        meetings.docs.map(async (meeting) => {
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
              ? (stockPresent.relatedStock as { id: string }).id
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
    ).filter((item): item is MeetingTableDataType => item !== null)

    return NextResponse.json({
      data: meetingData,
      totalItems: meetings.totalDocs,
      totalPages: meetings.totalPages
    })
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}
