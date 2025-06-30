import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import { getCompanyIdToSequenceMap, getMeetingIdToSequenceMap } from '@/utils/utils'
import { Vote } from '@/payload-types'
import { PromisePool } from '@/utils/promisePool'
import { sqlConfig } from '@/migrations/utils/utils'

// Mapping from MSSQL voting codes to MongoDB voting values
const votingResultMap: Record<string, string | null> = {
  '-2': '----',
  '-1': null, // 'הצבעות סותרות' -
  '0': '----',
  '1': 'בעד',
  '2': 'נגד',
  '3': 'דיון', //3	דיון
  '4': null, //הוסר מסדר היום
  '10': null, // אין חובת השתתפות
  '14': 'נמנע',
  '15': 'לא משתתף',
  '16': null, // 'ללא הצבעה' -
  '17': null, //נמכרה אחזקה
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting votes migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for votes.')
      return
    }

    // Get all meetings from MSSQL
    console.log('Executing SQL query for meetings.')
    const meetingsResult = await pool.request().query(`
        SELECT id
        FROM [dbEmda].[dbo].[meetings] WHERE mdate > '2018-01-01';
    `)

    const meetings = meetingsResult.recordset
    console.log(`Found ${meetings.length} meetings to process`)

    const seqMap = await getMeetingIdToSequenceMap(req.payload)

    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20)
    const promises = []
    const companyMap = await getCompanyIdToSequenceMap(payload)

    // Process each meeting in parallel using the promise pool
    for (const meeting of meetings) {
      promises.push(
        promisePool.add(async () => {
          try {
            // Find corresponding meeting in MongoDB
            const mongoMeetingId = seqMap.get(meeting.id.toString())

            if (!mongoMeetingId) {
              console.log(`Meeting with ID ${meeting.id} not found in MongoDB`)
              skippedCount++
              await logMigrationFault({
                payload,
                type: 'vote',
                typeId: `meeting-${meeting.id}`,
                comments: `Meeting with ID ${meeting.id} not found in MongoDB and votes cannot be migrated`,
                row: meeting,
              })
              return
            }

            // Get agenda items for this meeting
            const agendaResult = await pool?.request().query(`
                SELECT id
                FROM [dbEmda].[dbo].[meetingagenda]
                WHERE mid = ${meeting.id}
            `)

            const agendaItems = agendaResult?.recordset

            // Get companies related to this meeting using stored procedure
            const companiesResult = await pool
              ?.request()
              .input('mid', sql.Int, meeting.id)
              .execute('getMeetingFirmsDetails')

            const companies = companiesResult?.recordset

            // Collect all company IDs for this meeting
            const meetingCompanyIds: string[] = []

            // For each company, create a vote document
            if (companies)
              for (const company of companies) {
                const mongoCompanyId = companyMap.get(company.firmid.toString())

                // Add company ID to the list if it exists
                if (mongoCompanyId) {
                  meetingCompanyIds.push(mongoCompanyId)
                }

                if (!mongoCompanyId) {
                  console.log(
                    `Company with ID ${company.firmid} not found in MongoDB for meeting ${meeting.id}`,
                  )
                  await logMigrationFault({
                    payload,
                    type: 'vote',
                    typeId: `meeting-${meeting.id}-company-${company.firmid}`,
                    comments: `Company with ID ${company.firmid} not found in MongoDB and votes cannot be migrated for meeting ${meeting.id}`,
                    row: company,
                  })
                  continue
                }

                // Get voting data for this company and meeting using stored procedure
                const votingResult = await pool
                  ?.request()
                  .input('mid', sql.Int, meeting.id)
                  .execute('getMeetingAgendaClients')

                // Get voting orders memo from meetingclients table
                const meetingClientsResult = await pool?.request().query(`
                  SELECT [votingOrdersMemo]
                  FROM [dbEmda].[dbo].[meetingclients]
                  WHERE mid = ${meeting.id}
                    AND firmid = ${company.firmid}
                `)

                // Filter voting data to get only the votes for the current company
                const votingData = votingResult?.recordset.filter(
                  (vote) => vote.fid === company.firmid,
                )
                const meetingClientsData = meetingClientsResult?.recordset[0]

                // Extract votingOrdersMemo from meetingClients data
                const votingOrdersMemo = meetingClientsData?.votingOrdersMemo

                // Create votes array for MongoDB
                // First, create a map of agenda item IDs to their positions in the agenda
                const agendaItemPositions = new Map()
                agendaItems?.forEach((item, index) => {
                  agendaItemPositions.set(item.id, index + 1)
                })
                // Create votes array, preserving the order of agenda topics
                const votes = votingData?.map((vote) => {
                  const voteDecision = votingResultMap[vote.cdecision.toString()] || null
                  let noParticipantDuty = false
                  if (vote.voteDecision == 10 || vote.voteDecision == 14) {
                    noParticipantDuty = true
                  }
                  // Use the agenda item's position in the agenda as the topicIndex
                  // This preserves the order of topics as they appear in the agenda
                  const topicIndex = agendaItemPositions.get(vote.maid) || vote.maid

                  return {
                    topicIndex,
                    voteDecision,
                    noParticipantDuty,
                    comment: vote.comment || '',
                    clientComment: vote.ccomment || '',
                    committee: vote.committee === 1,
                    conflict: vote.conflict === 1,
                    relatedParty: vote.relatedParty === 1,
                    personalInterest: vote.pInterest === 1,
                    professionalFactor: vote.profFactor || '',
                  }
                })

                // Create or update vote document in MongoDB
                const voteData = {
                  meeting: mongoMeetingId,
                  company: mongoCompanyId,
                  reported: !!votingOrdersMemo, // Add the votingOrdersMemo field
                  votes,
                  _status: 'published',
                } as Partial<Vote>
                try {
                  // Create new vote
                  await payload.create({
                    collection: 'votes',
                    data: voteData as Vote,
                    req,
                  })
                  console.log(
                    `✓ Created vote for meeting ${meeting.id} and company ${company.firmid}`,
                  )
                  successCount++
                } catch (error: any) {
                  errorCount++
                  console.error(`✗ Failed to process votes for meeting ${meeting.id}:`, error)
                  await logMigrationFault({
                    payload,
                    type: 'vote',
                    typeId: `meeting-${meeting.id}`,
                    comments: `Failed to process votes for meeting ${meeting.id}: ${error.message}`,
                    row: JSON.stringify(voteData),
                  })
                }
              }

            // Update the meeting with the collected company IDs
            try {
              if (meetingCompanyIds.length > 0) {
                await payload.update({
                  collection: 'meetings',
                  id: mongoMeetingId,
                  data: {
                    companies: meetingCompanyIds,
                  },
                  req: {
                    ...req,
                    context: { ...req.context, from: 'migration' },
                  },
                })
                console.log(
                  `✓ Updated meeting ${meeting.id} with ${meetingCompanyIds.length} companies`,
                )
              }
            } catch (updateError: any) {
              console.error(`✗ Failed to update meeting ${meeting.id} with companies:`, updateError)
              await logMigrationFault({
                payload,
                type: 'meeting',
                typeId: `meeting-${meeting.id}`,
                comments: `Failed to update meeting ${meeting.id} with companies: ${updateError.message}`,
                row: meeting,
              })
            }
          } catch (error: any) {
            errorCount++
            console.error(`✗ Failed to process votes for meeting ${meeting.id}:`, error)
            await logMigrationFault({
              payload,
              type: 'vote',
              typeId: `meeting-${meeting.id}`,
              comments: `Failed to process votes for meeting ${meeting.id}: ${error.message}`,
              row: meeting,
            })
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

    console.log('\nMigration Summary:')
    console.log(`Total meetings processed: ${meetings.length}`)
    console.log(`Successfully processed: ${successCount}`)
    console.log(`Failed processing: ${errorCount}`)
    console.log(`Skipped (meeting not found): ${skippedCount}`)
    console.log('Votes migration completed successfully.')
  } catch (error) {
    console.error('Critical error during votes migration:', error)
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
