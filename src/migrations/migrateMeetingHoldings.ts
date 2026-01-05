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

    // Prefetch all funds with their account information to build a lookup map
    console.log('Prefetching funds with account information...')
    const allFunds = await payload.find({
      collection: 'companies',
      where: {
        type: { equals: 'fund' },
      },
      limit: 0,
      depth: 0,
      select: {
        mainAccount: true,
        legacyCompanyId: true,
      },
    })

    const fundAccountMap = new Map<string, string>()
    const subAccountKeySet = new Set<string>()

    allFunds.docs.forEach((fund) => {
      const legacyId = fund.legacyCompanyId
      if (legacyId && fund.mainAccount && Array.isArray(fund.mainAccount)) {
        fund.mainAccount.forEach((account) => {
          const accountNumStr = String(account.accountNumber)
          const baseKey = `${legacyId}_${accountNumStr}`

          // Map all sub-accounts first (lower priority)
          const subs = Array.isArray(account.subAccounts)
            ? account.subAccounts.map((s: any) => String(s))
            : []
          for (const sub of subs) {
            const subKey = `${legacyId}_${sub}`
            // Only set if not already set (or we can let it be overwritten,
            // but exact match must win in the end)
            fundAccountMap.set(subKey, String(fund.id))
            subAccountKeySet.add(subKey)
          }

          // Map the main account (higher priority, overrides sub-account mapping)
          fundAccountMap.set(baseKey, String(fund.id))
          // If it was in subAccountKeySet, remove it because it's an exact match here
          subAccountKeySet.delete(baseKey)
        })
      }
    })
    console.log(`Prefetched ${fundAccountMap.size} account mappings`)

    // Get all NON-finalized meetings from MongoDB
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        legacyIds: true,
        stock: true,
        stockId: true,
        legacyStockNum: true,
        funds: true,
        companies: true,
        fundsWithHolding: true,
        hasRelatedStocks: true,
      },
      /*  where: {
        finalized: { not_equals: true },
      },*/
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
      let legacyIdsToProcess: Set<string> = new Set()
      promises.push(
        promisePool.add(async () => {
          try {
            await withTimeout(
              (async () => {
                // Get the meeting ID
                const meetingId = meeting.id

                // Get all legacy IDs to fetch holdings for (primaryLegacyId + legacyIds array)
                legacyIdsToProcess = new Set<string>()
                if (meeting.legacyIds && Array.isArray(meeting.legacyIds)) {
                  meeting.legacyIds.forEach((id: any) => legacyIdsToProcess.add(String(id)))
                }

                if (legacyIdsToProcess.size === 0) {
                  console.log(`Meeting with ID ${meetingId} has no legacy IDs, skipping...`)
                  skippedCount++
                  return
                }

                const allFilteredHoldings: any[] = []

                // Fetch holdings for each legacy ID and merge them
                for (const legacyId of Array.from(legacyIdsToProcess)) {
                  // Call the stored procedure to get meeting holdings
                  const request = pool!.request()
                  request.input('MeetingId', sql.Int, parseInt(legacyId))
                  const result = await request.execute('getMeetingAccountHoldingsLast')

                  if (result.recordset && result.recordset.length > 0) {
                    // Filter out rows where qty is NULL and add to aggregate
                    const filtered = result.recordset.filter((row) => row.qty !== null)
                    allFilteredHoldings.push(...filtered)
                  }
                }

                if (allFilteredHoldings.length === 0) {
                  console.log(
                    `No holdings found for meeting ${meetingId} (legacyIds: ${Array.from(legacyIdsToProcess).join(',')}), skipping...`,
                  )
                  skippedCount++
                  return
                }

                // Create a map of firmId + accountNum -> fundId using the pre-built lookup map
                const fundMap = new Map()
                allFilteredHoldings.forEach((holding) => {
                  const key = `${holding.firmid}_${holding.accountNum}`
                  const fundId = fundAccountMap.get(key)
                  if (fundId) {
                    fundMap.set(key, fundId)
                    // Detect whether the match was via a subAccountNum and log it
                    if (subAccountKeySet.has(key)) {
                      const accountStr = String(holding.accountNum)
                      const msg = `Matched by subAccountNum: firmId=${holding.firmid}, accountNum=${accountStr}, fundId=${fundId}`
                      matchedBySubAccountMsgs.set(msg, (matchedBySubAccountMsgs.get(msg) || 0) + 1)
                    }
                  }
                })

                // Create fundsWithHolding array
                const fundsWithHolding = []
                const fromRelatedStock = meeting.legacyStockNum !== meeting.stockId

                for (const holding of allFilteredHoldings) {
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
                  funds: Array.from(new Set(fundsWithHolding.map((item) => item.fund))).sort(),
                  companies: Array.from(
                    new Set(fundsWithHolding.map((item) => item.company)),
                  ).sort(),
                  fundsWithHolding,
                } as Partial<Meeting>

                // Compare with current meeting data to skip update if no change
                const currentFunds = (meeting.funds || [])
                  .map((f: any) => (typeof f === 'object' ? f.id : f))
                  .sort()
                const currentCompanies = (meeting.companies || [])
                  .map((c: any) => (typeof c === 'object' ? c.id : c))
                  .sort()

                // Deep compare fundsWithHolding
                const isFundsWithHoldingEqual = (a: any[], b: any[]) => {
                  if (a.length !== b.length) return false
                  // Sort both arrays to ensure consistent comparison
                  const sortFn = (x: any, y: any) => {
                    const fundX = typeof x.fund === 'object' ? x.fund.id : x.fund
                    const fundY = typeof y.fund === 'object' ? y.fund.id : y.fund
                    return String(fundX).localeCompare(String(fundY)) || x.quantity - y.quantity
                  }

                  const sortedA = [...a].sort(sortFn)
                  const sortedB = [...b].sort(sortFn)

                  // Simplified comparison of key fields
                  for (let i = 0; i < sortedA.length; i++) {
                    const itemA = sortedA[i]
                    const itemB = sortedB[i]

                    const fundA = typeof itemA.fund === 'object' ? itemA.fund.id : itemA.fund
                    const fundB = typeof itemB.fund === 'object' ? itemB.fund.id : itemB.fund

                    if (fundA !== fundB) return false
                    if (itemA.quantity !== itemB.quantity) return false
                    if (itemA.ownedQuantity !== itemB.ownedQuantity) return false
                    if (itemA.verifiedHoldings !== itemB.verifiedHoldings) return false
                  }
                  return true
                }

                const noChange =
                  meeting.hasRelatedStocks === updatedMeeting.hasRelatedStocks &&
                  JSON.stringify(currentFunds) === JSON.stringify(updatedMeeting.funds) &&
                  JSON.stringify(currentCompanies) === JSON.stringify(updatedMeeting.companies) &&
                  isFundsWithHoldingEqual(
                    meeting.fundsWithHolding || [],
                    updatedMeeting.fundsWithHolding || [],
                  )

                if (noChange) {
                  console.log(
                    `- No change for Meeting: ${Array.from(legacyIdsToProcess).join(',')}, skipping update (${successCount + skippedCount + errorCount + 1}/${meetings.docs.length})`,
                  )
                  skippedCount++
                  return
                }

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
                  `✓ Updated Meeting: ${Array.from(legacyIdsToProcess).join(',')} with  ${updatedMeeting?.funds?.length} funds, and ${fundsWithHolding.length} fundsWithHolding (${successCount}/${meetings.docs.length})`,
                )
              })(),
              240000,
              `Timeout processing meeting ${meeting.id} after 240s`,
            )
          } catch (updateError: any) {
            errorCount++
            const legacyIdsStr = Array.from(legacyIdsToProcess || []).join(',')
            console.error(`✗ Failed to update Meeting ${legacyIdsStr}:`, updateError)
            logMigrationFault({
              payload,
              type: 'meeting',
              typeId: `${legacyIdsStr}`,
              comments: `Failed to update Meeting ${legacyIdsStr} with holdings: ${updateError.message}`,
              row: JSON.stringify({
                legacyIds: legacyIdsStr,
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
    console.log(`Skipped (no change, no holdings or invalid data): ${skippedCount}`)
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
