import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Meeting } from '@/payload-types'
import { getSequenceMeetingId } from '@/utils/utils'
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
    trustServerCertificate: true
  }
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
    let agendaItems: any[] = [];
    const useSingleQuery = true; // Set to true to use a single query, false to use separate queries

    if (useSingleQuery) {
      // Option 2: Use a single query with LEFT JOIN to get all data at once
      console.log('Executing single SQL query for meeting agenda and recommendations.')
      const result = await pool.request().query(`
        SELECT a.[id]
            ,a.[mid]
            ,a.[topic]
            ,a.[rec]
            ,a.[result]
            ,a.[vpercent]
            ,a.[vPercentSpecial]
            ,a.[vtype]
            ,a.[dealChanged]
            ,a.[agIdConnection]
            ,r.[Recommendation]
        FROM [dbEmda].[dbo].[meetingagenda] a
        LEFT JOIN [dbEmda].[dbo].[meetingagendarecommendation] r ON a.[id] = r.[maid]
        ORDER by a.[mid], a.[id]
      `)
      console.log(`Retrieved ${result?.recordset?.length} agenda records with recommendations from SQL Server`)

      // Process the results directly
      agendaItems = result.recordset;
    } else {
      // Option 1: Use separate queries
      console.log('Executing SQL query for meeting agenda.')
      const agendaResult = await pool.request().query(`
        SELECT [id]
            ,[mid]
            ,[topic]
            ,[rec]
            ,[result]
            ,[vpercent]
            ,[vPercentSpecial]
            ,[vtype]
            ,[dealChanged]
            ,[agIdConnection]
        FROM [dbEmda].[dbo].[meetingagenda]
        ORDER by [mid], [id]
      `)
      console.log(`Retrieved ${agendaResult?.recordset?.length} agenda records from SQL Server`)

      // Query the meetingagendarecommendation table
      console.log('Executing SQL query for meeting agenda recommendations.')
      const recommendationResult = await pool.request().query(`
        SELECT [maid]
            ,[Recommendation]
        FROM [dbEmda].[dbo].[meetingagendarecommendation]
      `)
      console.log(`Retrieved ${recommendationResult?.recordset?.length} recommendation records from SQL Server`)

      // Create a map of maid -> recommendation
      const recommendationMap = new Map<number, string>()
      for (const row of recommendationResult.recordset) {
        recommendationMap.set(row.maid, row.Recommendation)
      }

      // Add recommendation to agenda items
      agendaItems = agendaResult.recordset.map(row => ({
        ...row,
        Recommendation: recommendationMap.get(row.id) || ''
      }));
    }

    // Create a map of mid -> agendaItems
    const meetingAgendaMap = new Map<number, any[]>()
    for (const row of agendaItems) {
      if (!meetingAgendaMap.has(row.mid)) {
        meetingAgendaMap.set(row.mid, [])
      }

      // Store the original result value before mapping
      const originalResult = row.result;

      const agendaItem = {
        id: row.id,
        text: row.topic,
        topicType: row.result === 3 ? 'reporting' : 'decision', // Set to reporting if result is 3 (דיון), otherwise decision
        majorityType: row.vtype === 1 ? 'privileged' : 'regular', // Assuming vtype=1 means privileged majority
        result: row.result ? 
          (row.result === -2 || row.result === 4) ? '0' : row.result.toString() : '0', // Map -2 and 4 to 0, otherwise use string representation
        vpercent: row.vpercent,
        vPercentSpecial: row.vPercentSpecial,
        dealChanged: row.dealChanged === 1, // Convert to boolean
        recommendation: row.Recommendation || '',
        originalResult: originalResult // Store the original result value for later use
      }

      meetingAgendaMap.get(row.mid)?.push(agendaItem)
    }

    // Update meetings with agenda items
    console.log('Starting to update meetings with agenda items...')
    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20);
    const promises = [];

    // Process meetings in parallel using the promise pool
    for (const [mid, agendaItems] of meetingAgendaMap.entries()) {
      promises.push(
        promisePool.add(async () => {
          try {
            // Find the meeting in MongoDB
            const meetingId = await getSequenceMeetingId(payload, mid.toString())

            if (!meetingId) {
              console.log(`Meeting with ID ${mid} not found in MongoDB, skipping...`)
              skippedCount++
              await logMigrationFault({
                payload,
                type: 'meetingAgenda',
                typeId: `${mid}`,
                comments: `Meeting with ID ${mid} not found in MongoDB and agenda items will not be imported`,
                row: JSON.stringify({ mid, agendaItems })
              })
              return
            }

            // Get the current meeting data
            const meeting = await payload.findByID({
              collection: 'meetings',
              id: meetingId,
            }) as Meeting

            // Check if meeting already has agenda items
            const existingAgenda = meeting.agenda || [];
            console.log(`Meeting ${mid} has ${existingAgenda.length} existing agenda items and ${agendaItems.length} new agenda items`);

            // Update the meeting with agenda items
            const updatedMeeting = {
              ...meeting,
              agenda: agendaItems.map(item => ({
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
                ...(item.topicType === 'reporting' ? { readyForReport: false } : {})
              }))
            }

            // Update the meeting in MongoDB
            await payload.update({
              collection: 'meetings',
              id: meetingId,
              data: updatedMeeting,
              req,
            })

            successCount++
            console.log(`✓ Updated Meeting: ${mid} with ${agendaItems.length} agenda items (${successCount}/${meetingAgendaMap.size})`)
          } catch (updateError:any) {
            errorCount++
            console.error(`✗ Failed to update Meeting ${mid}:`, updateError)
            await logMigrationFault({
              payload,
              type: 'meetingAgenda',
              typeId: `${mid}`,
              comments: `Failed to update Meeting ${mid} with agenda items: ${updateError.message}`,
              row: JSON.stringify({ mid, agendaItems, error: updateError.message })
            })
          }
        })
      );
    }

    // Wait for all promises to complete
    await promisePool.waitForAll();

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
