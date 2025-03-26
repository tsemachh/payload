import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { MeetingTableDataType } from '../types/meetings'
import { headers as getHeaders } from 'next/headers.js'
import { StockValue } from '@/payload-types'

export async function fetchFutureMeetingsForTable(): Promise<{
  data: MeetingTableDataType[]
  totalItems: number
}> {
  const payload = await getPayload({ config })
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const meetings = await payload.find({
    collection: 'meetings',
    depth: 1,
    limit: 0,
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
        {
          companies: {
            in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
          },
        },
      ],
    },
  })

  const meetingData: MeetingTableDataType[] = (
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

        let stocksVales: StockValue | null = null
        let holdingsArray = null
        const stockIdToUse = stockPresent?.relatedStock
          ? (stockPresent?.relatedStock as { id: string }).id
          : stockPresent?.id

        if (meeting.holdingsLimit) {
          const { docs: resuStockValues } = await payload.find({
            collection: 'stock-values',
            depth: 1,
            where: {
              stockId: { equals: stockIdToUse },
              valueDate: { equals: new Date(meeting.holdingsLimit).toISOString() }, //need it?
            },
            limit: 0,
          })
          stocksVales = resuStockValues.length > 0 ? resuStockValues[0] : null

          const { docs: resuHoldings } = await payload.find({
            collection: 'holdings',
            depth: 0,
            where: {
              and: [
                { stock: { equals: stockIdToUse } },
                { valueDate: { equals: meeting.holdingsLimit } }, //update
                // { account: { in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id) } },
              ],
            },
            limit: 0,
          })
          if (stocksVales?.closingRate != null) {
            holdingsArray =
              resuHoldings.length > 0
                ? resuHoldings.map(({ quantity, valueDate }) => ({
                    holdingsCompanyName: 'שם ארוך מאד שך חברה אורכה מאד עם שם מוזר',
                    quantity,
                    valueDate,
                    percentageHolding: stocksVales?.registeredValue
                      ? (quantity / stocksVales?.registeredValue) * 100
                      : 0,
                    holdingValueInMillions: (quantity * (stocksVales?.closingRate ?? 0)) / 100000000, // שווי אחזקה במיליונים
                    registeredValue: 1111,
                  }))
                : null
          }
        }

        return {
          meetingId: meeting.meetingId,
          accounts: holdingsArray,
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
        } as MeetingTableDataType
      }),
    )
  ).filter((item): item is MeetingTableDataType => item !== null)

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
  }
}
