import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { MeetingTableDataType } from '../types/meetings'

export async function fetchMeetingsForTable(
  page: number = 1,
  pageSize: number = 0,
  onlyFuture: boolean = false,
): Promise<{
  data: MeetingTableDataType[]
  totalItems: number
  totalPages: number
}> {
  const payload = await getPayload({ config })
  const meetings = await payload.find({
    collection: 'meetings',
    limit: pageSize,
    page: page,
    where: onlyFuture
      ? {
          or: [
            {
              meetingDate: { greater_than_equal: new Date() },
            },
            {
              meetingDate: { exists: false },
            },
          ],
        }
      : {},
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

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
    totalPages: meetings.totalPages,
  }
}
