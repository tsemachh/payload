import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { createMSSqlPool } from '@/migrations/utils/utils'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import {
  convertMagnaToPayloadMeeting,
  MeetingFeedContext,
  processJsonMeetingRows,
} from '@/collections/meetings/feeds/processMeetingsFeedCsv'
import { convertMagnaAgendaToPayload } from '@/collections/meetings/feeds/processMeetingsAgendaFeedCsv'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting Magna meetings migration process...')
    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for Magna meetings.')
      return
    }

    // Calculate date 3 days ago
    const today = new Date()
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(today.getDate() - 3)

    // Format date as YYYY-MM-DD (e.g., '2025-06-06')
    const reportDate = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(threeDaysAgo.getDate()).padStart(2, '0')}`
    console.log(`Using report date: ${reportDate}`)

    // Call the stored procedure to get Magna meetings
    const request = pool.request()
    request.input('ReportDate', sql.VarChar, reportDate)

    console.log('Executing SQL stored procedure getMeetingsMagna...')
    const result = await request.execute('getMeetingsMagna')

    if (!result.recordset || result.recordset.length === 0) {
      console.log('No Magna meetings found, skipping...')
      return
    }

    console.log(`Retrieved ${result.recordset.length} Magna meeting records from SQL Server`)

    // Map the results using convertMagnaToPayloadMeeting
    const rows = result.recordset
      .map((data: any) => {
        try {
          return convertMagnaToPayloadMeeting(data)
        } catch (e: any) {
          console.error(`Error processing record: ${JSON.stringify(data)} - ${e.message}`)

          // Log the migration fault for individual record processing errors
          logMigrationFault({
            payload,
            type: 'meeting',
            severity: 'fatal',
            typeId: `${data.proofID || data.ProofId || 'unknown'}`,
            comments: `Magna meetings - Failed to parse date string: ${e.message}`,
            row: data,
          })

          return null
        }
      })
      .filter(Boolean) // Remove null values

    console.log(`Successfully mapped ${rows.length} Magna meeting records`)

    // Initialize context
    const context: MeetingFeedContext = {
      errors: [],
      successCount: 0,
      fileLength: rows.length,
      successPrevCount: 0,
      countTotalPrev: 0,
      processedMeetingIds: [],
    }

    // Process the mapped data using processJsonMeetingRows
    console.log('Processing Magna meeting records...')
    const result2 = await processJsonMeetingRows(rows, req, context)

    // Process agenda items for each meeting
    console.log('Processing agenda items for each meeting...')

    // Get all proofIDs from the processed meetings
    const proofIDs = rows.map((row) => row?.magnaId).filter(Boolean)
    console.log(`Found ${proofIDs.length} meetings with proofIDs`)

    let agendaSuccessCount = 0
    let agendaErrorCount = 0

    // Process each proofID
    for (const proofID of proofIDs) {
      try {
        // Query the MSSQL database for agenda items
        const agendaQuery = `
          SELECT [proofID]
                ,[MeetingItemIndex]
                ,[topic]
                ,[MajorityRequired]
                ,[OtherMajority]
            FROM [dbEmda].[dbo].[meetingagendaMagna]
            WHERE proofID='${proofID}'
            ORDER BY MeetingItemIndex
        `

        const agendaResult = await pool.request().query(agendaQuery)

        if (!agendaResult.recordset || agendaResult.recordset.length === 0) {
          console.log(`No agenda items found for meeting with proofID ${proofID}`)
          continue
        }

        console.log(
          `Found ${agendaResult.recordset.length} agenda items for meeting with proofID ${proofID}`,
        )

        // Convert each agenda item
        const agendaItems = agendaResult.recordset.map((item) => convertMagnaAgendaToPayload(item))

        // Find the meeting with that proofID
        const existingMeetings = await payload.find({
          collection: 'meetings',
          where: {
            magnaId: {
              equals: proofID,
            },
          },
          limit: 1,
        })

        if (!existingMeetings.docs || existingMeetings.docs.length === 0) {
          console.log(`No meeting found with proofID ${proofID}`)
          continue
        }

        const meeting = existingMeetings.docs[0]

        // Update the meeting with the agenda items
        await payload.update({
          collection: 'meetings',
          id: meeting.id,
          data: { agenda: agendaItems },
          context: { ...req.context, from: 'migration', process: 'migrateMagnaMeetings' },
          req,
        })

        agendaSuccessCount++
        console.log(
          `Successfully updated meeting ${proofID} with ${agendaItems.length} agenda items`,
        )
      } catch (error) {
        agendaErrorCount++
        console.error(`Error processing agenda items for meeting ${proofID}:`, error)

        // Log the migration fault
        logMigrationFault({
          payload,
          type: 'meeting',
          typeId: proofID,
          severity: 'fatal',
          comments: `Magna Meetings - Failed to process agenda items for meeting ${proofID}: ${error}`,
          row: JSON.stringify({ proofID }),
        })
      }
    }

    console.log(
      `Agenda processing complete. Success: ${agendaSuccessCount}, Errors: ${agendaErrorCount}`,
    )

    // Log results
    console.log('\nMagna Meetings Migration Summary:')
    console.log(`Total meetings processed: ${rows.length}`)
    console.log(`Successfully inserted/updated: ${result2.successCount}`)
    console.log(`Successfully updated previous meetings: ${result2.successPrevCount}`)
    console.log(`Total previous meetings found: ${result2.countTotalPrev}`)
    console.log(
      `Agenda items processing: ${agendaSuccessCount} meetings updated, ${agendaErrorCount} errors`,
    )

    if (result2.errors.length > 0) {
      console.error(`\nFinished with ${result2.errors.length} errors:`)
      result2.errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)

        // Log each error using logMigrationFault
        logMigrationFault({
          payload,
          type: 'meeting',
          severity: 'error',
          typeId: `magna-error-${idx}`,
          comments: `Magna Meetings - Failed to insert/update Meeting: ${err}`,
          row: JSON.stringify({ error: err }),
        })
      })
    }

    console.log('Magna meetings migration completed successfully.')
  } catch (error) {
    console.error('Critical error during Magna meetings migration:', error)

    // Log the migration fault
    await logMigrationFault({
      payload,
      type: 'meeting',
      severity: 'error',
      typeId: `magna-migration`,
      comments: `Magna Meetings - Failed to process Magna meetings: ${error}`,
      row: JSON.stringify({ error }),
    })

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
