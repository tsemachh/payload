import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { withTimeout } from '@/utils/withTimeout'
import { Meeting, Stock } from '@/payload-types'
import { createMSSqlPool } from '@/migrations/utils/utils'
import { getCompanyIdFromFundId, initFundIdToCompanyIdMap } from '@/utils/utils'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting meeting holdings migration process...')

    // Initialize the map of fundId -> companyId
    console.log('Initializing fundId -> companyId map')
    await initFundIdToCompanyIdMap(payload)
    console.log('Map initialized successfully')

    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for meeting holdings.')
      return
    }

    // Get all NON-finalized meetings from MongoDB
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        primaryLegacyId: true,
        stock: true,
        stockId: true,
        legacyStockNum: true,
      },
      where: {
        finalized: { not_equals: true },
      },
      limit: 0,
      depth: 0,
    })

    console.log(`Found ${meetings.docs.length} meetings in MongoDB`)

    // Create a promise pool with 5 concurrent threads
    const promisePool = new PromisePool(5)
    const promises = []

    // Process meetings in parallel using the promise pool
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0
    // Aggregate 'Matched by subAccountNum' messages to log once at the end
    const matchedBySubAccountMsgs = new Map<string, number>()

    for (const meeting of meetings.docs) {
      promises.push(
        promisePool.add(async () => {
          try {
            await withTimeout(
              (async () => {
                // Get the meeting ID from the sequence map
                const meetingId = meeting.id

                const meetingSeq = meeting.primaryLegacyId

                if (!meetingSeq) {
                  console.log(`Meeting with ID ${meetingId} has no meetingId, skipping...`)
                  skippedCount++
                  return
                }

                // Call the stored procedure to get meeting holdings
                const request = pool!.request()
                request.input('MeetingId', sql.Int, meetingSeq)
                const result = await request.execute('getMeetingAccountHoldingsLast')

                if (!result.recordset || result.recordset.length === 0) {
                  console.log(`No holdings found for meeting ${meetingSeq}, skipping...`)
                  skippedCount++
                  return
                }

                // Filter out rows where qty is NULL
                const filteredHoldings = result.recordset.filter((row) => row.qty !== null)

                if (filteredHoldings.length === 0) {
                  console.log(
                    `No valid holdings found for meeting ${meetingSeq} after filtering, skipping...`,
                  )
                  skippedCount++
                  return
                }

                // Find funds (companies of type 'fund') where parent company is one of the firmIds
                // and main account is the accountNum
                const fundsPromises = []

                for (const holding of filteredHoldings) {
                  fundsPromises.push(
                    payload.find({
                      collection: 'companies',
                      select: {
                        mainAccount: { accountNumber: true, subAccounts: true },
                        legacyCompanyId: true,
                      },
                      where: {
                        and: [
                          { type: { equals: 'fund' } },
                          { legacyCompanyId: { equals: holding.firmid } },
                          {
                            or: [
                              {
                                'mainAccount.accountNumber': {
                                  equals: holding.accountNum.toString(),
                                },
                              },
                              {
                                'mainAccount.subAccounts': {
                                  contains: holding.accountNum.toString(),
                                },
                              },
                            ],
                          },
                        ],
                      },
                      depth: 0,
                      limit: 0,
                    }),
                  )
                }

                const fundsResults = await Promise.all(fundsPromises)

                // Create a map of firmId + accountNum -> fundId using the matched account number per holding
                const fundMap = new Map()
                filteredHoldings.forEach((holding, idx) => {
                  const docs = fundsResults[idx]?.docs || []
                  if (docs.length > 0) {
                    const fund = docs[0] as any
                    const key = `${holding.firmid}_${holding.accountNum}`
                    fundMap.set(key, fund.id)
                    // Detect whether the match was via a subAccountNum and log it
                    const accountStr =
                      holding.accountNum?.toString?.() ?? String(holding.accountNum)
                    const accounts = Array.isArray(fund.mainAccount) ? fund.mainAccount : []
                    let matchedBySub = false
                    for (const acc of accounts) {
                      const subAccounts = Array.isArray(acc?.subAccounts)
                        ? acc.subAccounts.map((s: any) => String(s))
                        : []
                      if (subAccounts.includes(accountStr)) {
                        matchedBySub = true
                        break
                      }
                      if (String(acc?.accountNumber) === accountStr) {
                        matchedBySub = false
                        break
                      }
                    }
                    if (matchedBySub) {
                      const key = `Matched by subAccountNum: firmId=${holding.firmid}, accountNum=${accountStr}, fundId=${fund.id}`
                      matchedBySubAccountMsgs.set(key, (matchedBySubAccountMsgs.get(key) || 0) + 1)
                    }
                  }
                })

                // Create fundsWithHolding array
                const fundsWithHolding = []
                const fromRelatedStock = meeting.legacyStockNum !== meeting.stockId

                for (const holding of filteredHoldings) {
                  const key = `${holding.firmid}_${holding.accountNum}`
                  const fundId = fundMap.get(key)
                  if (fundId) {
                    const verifiedHoldings =
                      holding.ownedQty == holding.qty ? true : holding.ownedQty > 0 ? false : null

                    fundsWithHolding.push({
                      company: getCompanyIdFromFundId(fundId),
                      fund: fundId,
                      quantity: holding.qty,
                      // Reset ownedQuantity when verifiedHoldings is true or null
                      ownedQuantity: verifiedHoldings === false ? holding.ownedQty : 0,
                      verifiedHoldings,
                      feedStockNum: (meeting.stock as Stock).stockId || '', // Take stockNum from the meeting
                      fromRelatedStock,
                      original: [
                        {
                          quantity: holding.qty,
                          stockId: meeting.legacyStockNum,
                        },
                      ],
                    })
                  }
                }

                // Update the meeting with companies, funds, and fundsWithHolding
                const updatedMeeting = {
                  hasRelatedStocks: fromRelatedStock,
                  funds: Array.from(new Set(fundsWithHolding.map((item) => item.fund))),
                  companies: Array.from(new Set(fundsWithHolding.map((item) => item.company))),
                  fundsWithHolding,
                } as Partial<Meeting>

                // Update the meeting in MongoDB
                await payload.update({
                  collection: 'meetings',
                  id: meetingId,
                  data: updatedMeeting,
                  req,
                  context: {
                    ...req.context,
                    from: 'migration',
                    process: 'migrateMeetingHoldings',
                  },
                })

                successCount++
                console.log(
                  `✓ Updated Meeting: ${meetingSeq} with  ${updatedMeeting?.funds?.length} funds, and ${fundsWithHolding.length} fundsWithHolding (${successCount}/${meetings.docs.length})`,
                )
              })(),
              12000,
              `Timeout processing meeting ${meeting.id} after 180s`,
            )
          } catch (updateError: any) {
            errorCount++
            console.error(`✗ Failed to update Meeting ${meeting.primaryLegacyId}:`, updateError)
            logMigrationFault({
              payload,
              type: 'meeting',
              typeId: `${meeting.primaryLegacyId}`,
              comments: `Failed to update Meeting ${meeting.primaryLegacyId} with holdings: ${updateError.message}`,
              row: JSON.stringify({
                primaryLegacyId: meeting.primaryLegacyId,
                error: updateError.message,
              }),
            })
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

    // Emit consolidated 'matched by subAccountNum' logs
    if (matchedBySubAccountMsgs.size > 0) {
      console.log(
        '\n[migrateMeetingHoldings.up] Matched-by-subAccountNum summary (logged once at end):',
      )
      for (const [msg, count] of Array.from(matchedBySubAccountMsgs.entries())) {
        console.info(`${msg} | occurrences=${count}`)
      }
    }
    console.log('\nMigration Summary:')
    console.log(`Total meetings processed: ${meetings.docs.length}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    console.log(`Skipped (no holdings or invalid data): ${skippedCount}`)
    console.log('Migration completed successfully.')

    // Generate holdings report
    console.log('\nGenerating holdings report...')
    try {
      // Create a mock request object
      const mockReq = {
        payload,
        query: {},
        context: { from: 'migration', process: 'migrateMeetingHoldings' },
      }

      // Import the endpoint handler
      const { MeetingsVotesReportEndpoint } = await import(
        '@/collections/meetings/endpoints/MeetingsVotesReport'
      )

      // Call the endpoint
      const response = await MeetingsVotesReportEndpoint(mockReq as any)
      const responseData = await response.json()

      if (responseData.success) {
        console.log(`Holdings report generated successfully: ${responseData.filePath}`)
        console.log(
          `Found ${responseData.data.length} meetings with mismatched holdings and companies`,
        )
      } else {
        console.error('Failed to generate holdings report:', responseData.message)
      }
    } catch (error) {
      console.error('Error generating holdings report:', error)
    }
  } catch (error) {
    console.error('Critical error during migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  } finally {
    console.log('Closing SQL Server connection...')
    if (pool) {
      await pool.close() // Close the connection pool
    }
    console.log('SQL Server connection closed')
  }
}
