import { getPayload } from 'payload'
import 'dotenv/config'
import config from '@/payload.config'
import { MeetingTableDataType } from '../types/meetings'
import { headers as getHeaders } from 'next/headers.js'
import { Company, StockValue } from '@/payload-types'
import { calculateHoldingValues } from '../helpers/utils-data-table'

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
        {
          _status: {
            equals: 'published',
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

          // Find the intersection of meeting companies and user's leaf companies
          const relevantCompanyIds = (meeting.companies || [])
            .filter((company) =>
              user?.leafCompanies?.some(
                (leafCompany) =>
                  typeof leafCompany === 'object' &&
                  typeof company === 'object' &&
                  leafCompany.id === company.id,
              ),
            )
            .map((company) => (typeof company === 'object' ? company.id : null))
            .filter((id) => id !== null) as string[]

          // For each relevant company, find holdings and calculate values separately
          const results = await Promise.all(
            relevantCompanyIds.map(async (companyId) => {
              // For this specific company, find the nearest holdings date
              const { docs: companyDocs } = await payload.find({
                collection: 'holdings',
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
                companyDocs.length > 0 ? companyDocs[0].valueDate : null

              if (!nearestHoldingsLimitDate) {
                console.log(
                  ` --- Error! Could not find holdings date for company ID ${companyId} for meeting ${meeting.meetingId}`,
                )
                return null
              }
              // Get this company's holdings for this date
              const { docs: companyHoldings } = await payload.find({
                collection: 'holdings',
                depth: 2,
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
              const {
                holdingsCompanyName,
                percentageHolding,
                holdingValueInMillions,
                nominalValue,
              } = calculateHoldingValues(company, quantity, stockValues)

              return {
                companyData: {
                  holdingsCompanyName,
                  percentageHolding,
                  holdingValueInMillions,
                  nominalValue,
                  holdingsDate: nearestHoldingsLimitDate,
                },
                parentCompany: (company as Company).parentCompany as Company,
              }
            }),
          )
          
          const validResults = results.filter((result) => result !== null)
          
          // Separate arrays
          const companiesArray = validResults.map((r) => r!.companyData)
          const parentCompaniesArray = validResults.map((r) => r!.parentCompany)
          

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
            parentCompanies: parentCompaniesArray,
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
      }),
    )
  ).filter((item): item is MeetingTableDataType => item !== null)

  return {
    data: meetingData,
    totalItems: meetings.totalDocs,
  }
}
