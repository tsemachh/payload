import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Meeting, MeetingState, MeetingType } from '@/payload-types'
import { getSequenceMeetingId } from '@/utils/utils'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { getStockIdToSequenceMap } from '@/migrations/utils/migrateStockUtils'
import { createMSSqlPool } from '@/migrations/utils/utils'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

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
  [19, { newType: 'שנתית', newState: 'cancelled' }],
  [20, { newType: 'שנתית', newState: 'on-hold' }],
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
function getVotingRecommendation(
  rec: number | null | undefined,
): string | null | undefined | number {
  if (rec === null || rec === undefined) {
    return null
  }
  return recommendationMap.has(rec) ? recommendationMap.get(rec) : rec
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting full meeting migration process (meetings with agenda)...')
    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for meetings.')
      return
    }

    // Get meetings data
    console.log('Executing SQL query for meetings.')
    const dateCutoff = process.env.MIGRATION_VOTES_DATE_CUTOFF || '2018-01-01'
    console.log(`Using date cutoff: ${dateCutoff}`)
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
        FROM [dbEmda].[dbo].[meetings] WHERE mdate > '${dateCutoff}';
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
             , a.[percentResult]
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

      const topicType = row.vtype === 0 ? 'reporting' : 'decision' // Set to reporting if result is 3 (דיון), otherwise decision
      const isDecision = topicType === 'decision'
      const agendaItem = {
        id: row.id,
        text: row.topic,
        topicType: topicType,
        majorityType: isDecision ? (row.vtype === 2 ? 'privileged' : 'regular') : null, // Assuming vtype=2 means privileged majority
        result: row.result
          ? row.result === -2 || row.result === 4
            ? '0'
            : row.result.toString()
          : '0', // Map -2 and 4 to 0, otherwise use string representation
        vpercent: isDecision ? row.vpercent : null,
        percentResult: isDecision ? (row.percentResult === -1 ? null : row.percentResult) : null,
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
      // Capture the meetingAgendaMap in closure to avoid race conditions
      const agendaMap = meetingAgendaMap
      row.stockID = `${row.stockID}`
      // Find stockId
      const stockId = stockMap.get(`${row.stockID}`)
      if (stockId === undefined) {
        console.log("Stockid can't be found:", row.stockID)
        await logMigrationFault({
          payload,
          type: 'meeting',
          typeId: `${row.id}`,
          comments: `Meeting with ID ${row.id} has stockId ${row.stockID} that can't be found and will not be imported`,
          row,
        })
        skippedCount++
        continue // Use continue instead of return to skip this iteration
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
          // Preserving original meeting date for on-hold meetings
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
        continue // Use continue instead of return to skip this iteration
      }

      // Get agenda items for this meeting using the captured map reference
      const agendaItems = agendaMap.get(Number(row.id)) || []

      // Add defensive logging to debug empty map issues
      if (agendaMap.size === 0) {
        console.error(`Warning: agendaMap is empty for meeting ${row.id}`)
      }

      // Create a copy of the row to avoid reference issues in closures
      const currentRow = { ...row }
      const currentStockId = stockId
      const currentNewType = newType
      const currentNewState = newState
      const currentAgendaItems = [...agendaItems]

      promises.push(
        promisePool.add(async () => {
          try {
            // Prepare meeting data with agenda inside the promise to avoid shared reference issues
            const meetingData: Partial<Meeting> = {
              meetingId: `${currentRow.id}`,
              stock: currentStockId as string,
              magnaId: currentRow.proofId,
              meetingDate: currentRow.mdate, // Keep as string instead of converting to Date
              holdingsLimit: currentRow.sdate, // Keep as string instead of converting to Date
              proxyVotingDate: currentRow.proxyStatementDate,
              location: currentRow.location,
              type: currentNewType as MeetingType,
              state: currentNewState as MeetingState,
              comments: currentRow.comments,
              resultsConfirmationStatus: !!currentRow.ResultConfirm,
              electronicVotingEnabled: !!currentRow.ElectronicVoting,
              _status: 'published' as const,
              agenda: currentAgendaItems.map((item) => ({
                text: item.text,
                topicType: item.topicType,
                majorityType: item.majorityType,
                result: item.result,
                vpercent: item.vpercent,
                percentResult: item.percentResult === -1 ? null : item.percentResult,
                dealChanged: item.dealChanged,
                recommendation: item.recommendation,
                isRemovedFromAgenda: item.isRemovedFromAgenda,
              })),
            }

            if (!currentRow.proofId && currentRow?.link2?.startsWith('http')) {
              meetingData.invitationLink = currentRow.link2
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
              `✓ Inserted/Updated Meeting: ${currentRow.id} with ${meetingData.agenda?.length} agenda items (${successCount}/${meetingsResult.recordset.length})`,
            )
          } catch (insertError) {
            console.log('Row', JSON.stringify(currentRow, null, 2))
            errorCount++
            console.error(`✗ Failed to insert Meeting ${currentRow.id}:`, insertError)
            await logMigrationFault({
              payload,
              type: 'meeting',
              typeId: `${currentRow.id}`,
              comments: `Failed to insert/update Meeting ${currentRow.id}: ${insertError}`,
              row: currentRow,
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
