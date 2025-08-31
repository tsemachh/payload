import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { Stock } from '@/payload-types'
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

    // Get all meetings from MongoDB
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        meetingId: true,
        stock: true,
      },
      limit: 0,
      depth: 1,
    })

    console.log(`Found ${meetings.docs.length} meetings in MongoDB`)

    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20)
    const promises = []

    // Process meetings in parallel using the promise pool
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const meeting of meetings.docs) {
      promises.push(
        promisePool.add(async () => {
          try {
            // Get the meeting ID from the sequence map
            const meetingId = meeting.id
            const meetingSeq = meeting.meetingId

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
                    mainAccount: { accountNumber: true },
                    legacyCompanyId: true,
                  },
                  where: {
                    type: {
                      equals: 'fund',
                    },
                    legacyCompanyId: {
                      equals: holding.firmid,
                    },
                    'mainAccount.accountNumber': {
                      equals: holding.accountNum.toString(),
                    },
                  },
                  depth: 0,
                  limit: 0,
                }),
              )
            }

            const fundsResults = await Promise.all(fundsPromises)
            // Flatten the results and filter for funds whose parent company is one of the firmIds
            const allFunds = fundsResults.flatMap((result) => result.docs)

            // Create a map of firmId + accountNum -> fundId
            const fundMap = new Map()
            for (const fund of allFunds) {
              // Create a key using firmId + accountNum

              // @ts-ignore
              const key = `${fund.legacyCompanyId}_${fund?.mainAccount[0].accountNumber}`

              // Map to fundId
              fundMap.set(key, fund.id)
            }

            // Create fundsWithHolding array
            const fundsWithHolding = []

            for (const holding of filteredHoldings) {
              const key = `${holding.firmid}_${holding.accountNum}`
              const fundId = fundMap.get(key)

              if (fundId) {
                fundsWithHolding.push({
                  company: getCompanyIdFromFundId(fundId),
                  fund: fundId,
                  quantity: holding.qty,
                  ownedQuantity: holding.ownedQty,
                  verifiedHoldings:
                    holding.ownedQty == holding.qty ? true : holding.ownedQty > 0 ? false : null,
                  feedStockNum: (meeting.stock as Stock).stockId || '', // Take stockNum from the meeting
                })
              }
            }

            // Update the meeting with companies, funds, and fundsWithHolding
            const updatedMeeting = {
              funds: Array.from(new Set(fundsWithHolding.map((item) => item.fund))),
              fundsWithHolding: fundsWithHolding,
            }

            // Update the meeting in MongoDB
            const updateResult = await payload.update({
              collection: 'meetings',
              id: meetingId,
              data: updatedMeeting,
              req,
              context: { ...req.context, from: 'migration' },
            })

            successCount++
            console.log(
              `✓ Updated Meeting: ${meetingSeq} with  ${updatedMeeting.funds.length} funds, and ${fundsWithHolding.length} fundsWithHolding (${successCount}/${meetings.docs.length})`,
            )
          } catch (updateError: any) {
            errorCount++
            console.error(`✗ Failed to update Meeting ${meeting.meetingId}:`, updateError)
            logMigrationFault({
              payload,
              type: 'meeting',
              typeId: `${meeting.meetingId}`,
              comments: `Failed to update Meeting ${meeting.meetingId} with holdings: ${updateError.message}`,
              row: JSON.stringify({
                meetingId: meeting.meetingId,
                error: updateError.message,
              }),
            })
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

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
        context: { from: 'migration' },
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
