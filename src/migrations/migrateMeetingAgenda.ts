import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { getMeetingIdToSequenceMap } from '@/utils/utils'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'dbEmda', // Use the actual database name
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting meeting agenda migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for meeting agenda.')
      return
    }

    // Option 1: Use separate queries (default)
    let agendaItems: any[] = []

    // Option 2: Use a single query with LEFT JOIN to get all data at once
    console.log('Executing single SQL query for meeting agenda and recommendations.')
    const result = await pool.request().query(`
        SELECT a.[id]
             , a.[mid]
             , a.[topic]
             , a.[rec]
             , a.[result]
             , a.[vpercent]
             , a.[vPercentSpecial]
             , a.[vtype]
             , a.[dealChanged]
             , a.[agIdConnection]
             , r.[Recommendation]
        FROM [dbEmda].[dbo].[meetingagenda] a
                 LEFT JOIN [dbEmda].[dbo].[meetingagendarecommendation] r ON a.[id] = r.[maid]
        ORDER by a.[mid], a.[id]
    `)
      console.log(`Retrieved ${result?.recordset?.length} agenda records with recommendations from SQL Server`)

    // Process the results directly
    agendaItems = result.recordset

    // Create a map of mid -> agendaItems
    const meetingAgendaMap = new Map<number, any[]>()
    for (const row of agendaItems) {
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
        recommendation: row.Recommendation || '',
        originalResult: originalResult, // Store the original result value for later use
      }

      meetingAgendaMap.get(row.mid)?.push(agendaItem)
    }

    // Update meetings with agenda items
    console.log('Starting to update meetings with agenda items...')
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20)
    const promises = []
    const seqMap=await getMeetingIdToSequenceMap(req.payload)
    // Process meetings in parallel using the promise pool
    for (const [mid, agendaItems] of meetingAgendaMap.entries()) {
      promises.push(
        promisePool.add(async () => {
          try {
            // Find the meeting in MongoDB
            const meetingId = seqMap.get(mid.toString())
            if (!meetingId) {
              console.log(`Meeting with ID ${mid} not found in MongoDB, skipping...`)
              skippedCount++
              logMigrationFault({
                payload,
                type: 'meetingAgenda',
                typeId: `${mid}`,
                comments: `Meeting with ID ${mid} not found in MongoDB and agenda items will not be imported`,
                row: JSON.stringify({ mid, agendaItems }),
              })
              return
            }

            // Update the meeting with agenda items
            const updatedMeeting = {
              agenda: agendaItems.map((item) => ({
                text: item.text,
                topicType: item.topicType,
                majorityType: item.majorityType,
                result: item.result,
                vpercent: item.vpercent,
                vPercentSpecial: item.vPercentSpecial,
                dealChanged: item.dealChanged,
                recommendation: item.recommendation,
                // Add default values for required fields that might not be in the source data
                isRemovedFromAgenda: item.originalResult === 4, // Set to true if original result is 4 (הוסר מסדר היום)
                // readyForReport is only for reporting type topics, now used when topicType is reporting
                ...(item.topicType === 'reporting' ? { readyForReport: false } : {}),
              })),
            }

            // Update the meeting in MongoDB
            await payload.update({
              collection: 'meetings',
              id: meetingId,
              data: updatedMeeting,
              req,
              context: { ...req.context, from: 'migration' }
            })

            successCount++
            console.log(
              `✓ Updated Meeting: ${mid} with ${agendaItems.length} agenda items (${successCount}/${meetingAgendaMap.size})`,
            )
          } catch (updateError: any) {
            errorCount++
            console.error(`✗ Failed to update Meeting ${mid}:`, updateError)
            logMigrationFault({
              payload,
              type: 'meetingAgenda',
              typeId: `${mid}`,
              comments: `Failed to update Meeting ${mid} with agenda items: ${updateError.message}`,
              row: JSON.stringify({ mid, agendaItems, error: updateError.message }),
            })
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

    console.log('\nMigration Summary:')
    console.log(`Total meetings processed: ${meetingAgendaMap.size}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    console.log(`Skipped (meeting not found): ${skippedCount}`)
    console.log('Migration completed successfully.')
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
