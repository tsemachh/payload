import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Meeting, MeetingState, MeetingType } from '@/payload-types'
import { getSequenceMeetingId, getCompanyIdToChildCompanies, getCompanyIdToSequenceMap } from '@/utils/utils'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { getStockIdToSequenceMap } from '@/utils/migrateStockUtils'
import { sqlConfig } from '@/migrations/utils/utils'

// Minimum date for holdings (January 1, 2024)
const MIN_HOLDINGS_DATE = '2024-01-01'

interface StockFirmRow {
  stockNum: string
  firm: string
}

async function getDistinctStockFirms(pool: sql.ConnectionPool): Promise<sql.IResult<StockFirmRow>> {
  return await pool.request().query(`
    SELECT distinct [stockNum]
      ,[firm]
    FROM [dbEmda].[dbo].[holdings]
    WHERE [date1] >= '${MIN_HOLDINGS_DATE}'
  `)
}

// Define the mapping for TypeId to newType and newState
const typeMappings = new Map<number, { newType: string | null; newState: string | null }>([
  [-1, { newType: null, newState: null }],
  [1, { newType: 'שנתית', newState: null }],
  [2, { newType: 'שנתית', newState: 'postponed' }],
  [4, { newType: 'מיוחדת', newState: null }],
  [5, { newType: 'מיוחדת', newState: 'postponed' }],
  [7, { newType: 'אג"ח', newState: null }],
  [8, { newType: 'אג"ח', newState: 'postponed' }],
  [9, { newType: 'אג"ח', newState: 'ongoing' }],
  [10, { newType: 'אופציה', newState: null }],
  [11, { newType: 'אופציה', newState: 'postponed' }],
  [13, { newType: 'יחידת השתתפות', newState: null }],
  [14, { newType: 'יחידת השתתפות', newState: 'postponed' }],
  [16, { newType: 'תעודת סל', newState: null }],
  [17, { newType: 'תעודת סל', newState: 'postponed' }],
  [19, { newType: null, newState: 'cancelled' }],
  [20, { newType: null, newState: 'on-hold' }],
  [30, { newType: 'אג"ח כהונת נאמן', newState: null }],
])

// Function to get newType and newState based on TypeId
function getTypeAndState(typeId: number): {
  newType: string | null
  newState: string | null
} {
  const mapping = typeMappings.get(typeId)
  if (mapping) {
    return mapping
  } else {
    throw new Error(`TypeId ${typeId} not found in mappings.`)
  }
}

// Map recommendation codes to their corresponding display values
const recommendationMap = new Map<number, string | null>([
  [-2, '----'],
  [0, null],
  [1, 'בעד'],
  [2, 'נגד'],
  [3, 'דיון'],
  [4, '----'], // Changed from 'הוסר מסדר היום' to '----' to align with schema options
  [5, 'נמנע'], // Added mapping for 'נמנע' (abstain)
])

// Function to get the voting recommendation based on the recommendation code
function getVotingRecommendation(rec: number): string | null | undefined | number {
  return recommendationMap.has(rec) ? recommendationMap.get(rec) : rec
}

// Function to migrate silenced stocks companies
async function migrateSilencedStocksCompanies(payload: any, req: any, pool: sql.ConnectionPool): Promise<void> {
  try {
    console.log('Starting silenced stocks companies migration process...')

    // Initialize counters
    let successCount = 0
    let errorCount = 0

    // Preload company mappings
    console.log('Preloading company mappings...')
    const companyIdToSequence = await getCompanyIdToSequenceMap(payload)
    const companyIdToChildCompanies = await getCompanyIdToChildCompanies(payload)
    console.log(`Preloaded ${companyIdToSequence.size} companies`)
    console.log(`Preloaded ${companyIdToChildCompanies.size} companies with child companies`)

    // Get distinct stockNum and firm from holdings table
    console.log('Fetching distinct stock numbers and firms from holdings...')
    const stockFirmsResult = await getDistinctStockFirms(pool)
    console.log(
      `Found ${stockFirmsResult.recordset.length} distinct stock-firm pairs from ${MIN_HOLDINGS_DATE}`,
    )

    // Create a map of company ID to silenced stocks
    const companyToStocks = new Map<string, Set<string>>()

    // Create a map of stockNum to firms from holdings
    const stockToFirms = new Map<string, Set<string>>()
    for (const row of stockFirmsResult.recordset) {
      if (!stockToFirms.has(`${row.stockNum}`)) {
        stockToFirms.set(`${row.stockNum}`, new Set<string>())
      }
      stockToFirms.get(`${row.stockNum}`)?.add(`${row.firm}`)
    }

    // Read all entries from SilencedStocks collection
    console.log('Fetching all silenced stocks...')
    const silencedStocks = await payload.find({
      collection: 'silenced-stocks',
      limit: 0,
      req,
    })
    console.log(`Found ${silencedStocks.docs.length} silenced stocks`)

    // For each silenced stock, find the firm IDs pointing to it and add to company-to-stocks map
    for (const silencedStock of silencedStocks.docs) {
      const stockId = silencedStock.stockId
      if (!stockId) {
        console.warn(`Silenced stock with ID ${silencedStock.id} has no stockId, skipping`)
        continue
      }

      // Get firms for this stock
      const firms = stockToFirms.get(stockId)
      if (!firms || firms.size === 0) {
        console.log(`No firms found for silenced stock ${stockId}, skipping`)
        continue
      }

      // Convert firms to company IDs and add stock to each company
      for (const firm of firms) {
        const companyId = companyIdToSequence.get(firm)
        if (companyId) {
          // Add stock to company
          if (!companyToStocks.has(companyId)) {
            companyToStocks.set(companyId, new Set<string>())
          }
          companyToStocks.get(companyId)?.add(stockId)

          /*          // Also add to child companies
          const companyChildIds = companyIdToChildCompanies.get(firm)
          if (companyChildIds && companyChildIds.length > 0) {
            for (const childId of companyChildIds) {
              if (!companyToStocks.has(childId)) {
                companyToStocks.set(childId, new Set<string>())
              }
              companyToStocks.get(childId)?.add(stockId)
            }
          }*/
        } else {
          console.warn(`Company ID not found for firm: ${firm}`)
        }
      }
    }

    // Update each company with its silenced stocks
    const companyIds = Array.from(companyToStocks.keys())
    console.log(`Updating ${companyIds.length} companies with silenced stocks...`)

    for (const companyId of companyIds) {
      try {
        const silencedStockIds = Array.from(companyToStocks.get(companyId) || [])

        if (silencedStockIds.length === 0) {
          console.log(`No silenced stocks for company ${companyId}, skipping`)
          continue
        }

        // Update the company with its silenced stocks
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            silencedStocks: silencedStockIds,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration' },
          },
        })

        successCount++
        console.log(
          `✓ Updated company ${companyId} with ${silencedStockIds.length} silenced stocks (${successCount}/${companyIds.length})`,
        )
      } catch (error) {
        errorCount++
        console.error(`Error updating company ${companyId}:`, error)
        await logMigrationFault({
          payload,
          type: 'company',
          row: JSON.stringify({ companyId }),
          typeId: companyId,
          comments: createErrorFaultComment({
            id: companyId,
            operation: 'Update company silenced stocks',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
      }
    }

    console.log('\nSilenced Stocks Migration Summary:')
    console.log(`Total companies processed: ${companyIds.length}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    console.log('Silenced stocks migration completed successfully.')
  } catch (error) {
    console.error('Critical error during silenced stocks migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  }
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting full meeting migration process (meetings with agenda)...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for meetings.')
      return
    }

    // Get meetings data
    console.log('Executing SQL query for meetings.')
    const meetingsQuery = `
        SELECT  [id]
             ,[proofId]
             ,CONVERT(VARCHAR, [mdate], 127) AS [mdate]
             ,CONVERT(VARCHAR, [sdate], 127) AS [sdate]
             ,CONVERT(VARCHAR, [proxyStatementDate], 127) AS [proxyStatementDate]
             ,[stockID]
             ,[location]
             ,[mtype]
             ,[link2]
             ,[comments]
             ,[ResultConfirm]
             ,[ElectronicVoting]
             ,[CommiteeRequest]
        FROM [dbEmda].[dbo].[meetings] WHERE mdate > '2018-01-01';
    `
    const meetingsResult = await pool.request().query(meetingsQuery)
    console.log(`Retrieved ${meetingsResult?.recordset?.length} meeting records from SQL Server`)

    // Get agenda data
    console.log('Executing SQL query for meeting agenda and recommendations.')
    const agendaQuery = `
        SELECT a.[id]
             , a.[mid]
             , a.[topic]
             , a.[result]
             , a.[vpercent]
             , a.[vPercentSpecial]
             , a.[vtype]
             , a.[dealChanged]
             , a.[rec]
             , r.[Recommendation]
        FROM [dbEmda].[dbo].[meetingagenda] a
                 LEFT JOIN [dbEmda].[dbo].[meetingagendarecommendation] r ON a.[id] = r.[maid]
        ORDER by a.[mid], a.[id]
    `
    const agendaResult = await pool.request().query(agendaQuery)
    console.log(`Retrieved ${agendaResult?.recordset?.length} agenda records from SQL Server`)

    // Create a map of meeting ID to agenda items
    const meetingAgendaMap = new Map<number, any[]>()
    for (const row of agendaResult.recordset) {
      if (!meetingAgendaMap.has(row.mid)) {
        meetingAgendaMap.set(row.mid, [])
      }

      // Store the original result value before mapping
      const originalResult = row.result

      const agendaItem = {
        id: row.id,
        text: row.topic,
        topicType: row.result === 3 ? 'reporting' : 'decision', // Set to reporting if result is 3 (דיון), otherwise decision
        majorityType: row.vtype === 1 ? 'privileged' : 'regular', // Assuming vtype=1 means privileged majority
        result: row.result
          ? row.result === -2 || row.result === 4
            ? '0'
            : row.result.toString()
          : '0', // Map -2 and 4 to 0, otherwise use string representation
        vpercent: row.vpercent,
        vPercentSpecial: row.vPercentSpecial,
        dealChanged: row.dealChanged === 1, // Convert to boolean
        recommendation: {
          votingRecommendation: getVotingRecommendation(row.rec),
          reasonText: row.Recommendation || '',
          reasonRef: 'אחר',
        },
        isRemovedFromAgenda: originalResult === 4, // Set to true if original result is 4 (הוסר מסדר היום)
      }

      meetingAgendaMap.get(row.mid)?.push(agendaItem)
    }

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20)
    const promises = []
    const stockMap = await getStockIdToSequenceMap(req)

    // Process each meeting in parallel using the promise pool
    for (const row of meetingsResult.recordset) {
      promises.push(
        promisePool.add(async () => {
          try {
            row.stockID = `${row.stockID}`
            // Find stockId
            const stockId = stockMap.get(`${row.stockID}`)
            if (stockId === undefined) {
              console.log("Stockid can't be found:", row.stockID)
              logMigrationFault({
                payload,
                type: 'meeting',
                typeId: `${row.id}`,
                comments: `Meeting with ID ${row.id} has stockId ${row.stockID} that can't be found and will not be imported`,
                row,
              })
              skippedCount++
              return
            }

            // Find meetingTypeId
            const { newType } = getTypeAndState(row.mtype)
            let { newState } = getTypeAndState(row.mtype)

            // Create Date objects only for comparison purposes
            const meetingDate = row.mdate ? new Date(row.mdate) : null
            const now = new Date()

            if (newState == null) {
              newState = meetingDate && meetingDate > now ? 'scheduled' : 'completed'
            }

            switch (newState) {
              case 'postponed':
              case 'ongoing':
                if (meetingDate && meetingDate < now) {
                  newState = 'completed'
                }
                break
              case 'on-hold':
                row.mdate = null
                break
            }

            if (row.mdate == null && newState != 'on-hold') {
              await logMigrationFault({
                payload,
                type: 'meeting',
                typeId: `${row.id}`,
                comments: `Meeting with ID ${row.id} has null mdate and will not be imported`,
                row,
              })
              skippedCount++
              return
            }

            // Get agenda items for this meeting
            const agendaItems = meetingAgendaMap.get(row.id) || []

            // Prepare meeting data with agenda
            const meetingData: Partial<Meeting> = {
              meetingId: `${row.id}`,
              stock: stockId as string,
              magnaId: row.proofId,
              meetingDate: row.mdate, // Keep as string instead of converting to Date
              holdingsLimit: row.sdate, // Keep as string instead of converting to Date
              proxyVotingDate: row.proxyStatementDate,
              location: row.location,
              type: newType as MeetingType,
              state: newState as MeetingState,
              comments: row.comments,
              resultsConfirmationStatus: !!row.ResultConfirm,
              electronicVotingEnabled: !!row.ElectronicVoting,
              committeeInitiated: !!row.CommiteeRequest,
              _status: 'published' as const,
              agenda: agendaItems.map((item) => ({
                text: item.text,
                topicType: item.topicType,
                majorityType: item.majorityType,
                result: item.result,
                vpercent: item.vpercent,
                vPercentSpecial: item.vPercentSpecial,
                dealChanged: item.dealChanged,
                recommendation: item.recommendation,
                isRemovedFromAgenda: item.isRemovedFromAgenda,
              })),
            }

            if (!row.proofId && row?.link2?.startsWith('http')) {
              meetingData.invitationLink = row.link2
            }

            const id = await getSequenceMeetingId(payload, meetingData.meetingId as string)
            if (id) {
              // Update Payload CMS
              await payload.update({
                collection: 'meetings',
                id: id,
                data: meetingData,
                req: {
                  ...req,
                  context: { ...req.context, from: 'migration' },
                },
              })
            } else {
              // Insert into Payload CMS
              await payload.create({
                collection: 'meetings',
                data: meetingData as Meeting,
                req: {
                  ...req,
                  context: { ...req.context, from: 'migration' },
                },
              })
            }

            successCount++
            console.log(
              `✓ Inserted/Updated Meeting: ${row.id} with ${agendaItems.length} agenda items (${successCount}/${meetingsResult.recordset.length})`,
            )
          } catch (insertError) {
            console.log('Row', JSON.stringify(row, null, 2))
            errorCount++
            console.error(`✗ Failed to insert Meeting ${row.id}:`, insertError)
            logMigrationFault({
              payload,
              type: 'meeting',
              typeId: `${row.id}`,
              comments: `Failed to insert/update Meeting ${row.id}: ${insertError}`,
              row,
            })
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

    console.log('\nMeetings Migration Summary:')
    console.log(`Total meetings processed: ${meetingsResult.recordset.length}`)
    console.log(`Successfully inserted/updated: ${successCount}`)
    console.log(`Failed insertions/updates: ${errorCount}`)
    console.log(`Skipped meetings: ${skippedCount}`)
    console.log('Meetings migration completed successfully.')

    // Now run the silenced stocks companies migration
    console.log('\n=== Starting Silenced Stocks Companies Migration ===')
    await migrateSilencedStocksCompanies(payload, req, pool)
    console.log('=== Silenced Stocks Companies Migration Completed ===\n')
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

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
