import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { MeetingTableDataType } from '../types/meetings'
import { headers as getHeaders } from 'next/headers.js'
import { StockValue } from '@/payload-types'
import { calculateHoldingValues } from '@/utils/utils'

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
        let stockValues: StockValue | null = null
        let holdingsArray = null
        const stockIdToUse = stockPresent?.relatedStock
          ? (stockPresent?.relatedStock as { id: string }).id
          : stockPresent?.id
        // Finding Date: holdingsLimit date or the closest date before it.
        const { docs } = await payload.find({
          collection: 'holdings',
          depth: 0,
          where: {
            and: [
              { stock: { equals: stockIdToUse } },
              { valueDate: { less_than_equal: meeting.holdingsLimit } },
              {
                'account.company': {
                  in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
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
              valueDate: { equals: new Date(nearestHoldingsLimitDate).toISOString() },
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
                { valueDate: { equals: nearestHoldingsLimitDate } },
                {
                  'account.company': {
                    in: user?.leafCompanies?.map((e) => typeof e === 'object' && e.id),
                  },
                },
              ],
            },
            limit: 0,
          })
          const resuHoldings = holdingsLimitDateDocs

          // Implementation of holdings values
          holdingsArray = resuHoldings.map(({ account, quantity }) => {
            const { holdingsCompanyName, percentageHolding, holdingValueInMillions, nominalValue } =
              calculateHoldingValues(account, quantity, stockValues)
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
          accounts: holdingsArray,
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
          nominalValue: holdingsArray?.reduce((acc, obj) => acc + obj.nominalValue, 0),
          percentageHolding: holdingsArray?.reduce((acc, obj) => acc + obj.percentageHolding, 0),
          holdingValueInMillions: holdingsArray?.reduce(
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
  ).filter((item): item is MeetingTableDataType => item !== null)

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
  }
}
