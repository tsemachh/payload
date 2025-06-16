import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import { getCompanyIdToSequenceMap, getMeetingIdToSequenceMap } from '@/utils/utils'
import { Vote } from '@/payload-types'
import { PromisePool } from '@/utils/promisePool'

// Mapping from MSSQL voting codes to MongoDB voting values
const votingResultMap: Record<string, string | null> = {
  '-2': null,
  '-1': null, // 'הצבעות סותרות' - not in options
  '0': null,
  '1': 'בעד',
  '2': 'נגד',
  '3': 'דיון',
  '4': null, // 'הוסר מסדר היום' - not in options
  '10': 'אין חובת השתתפות',
  '14': 'נמנע',
  '15': 'לא משתתף',
  '16': null, // 'ללא הצבעה' - not in options
  '17': 'אין חובת השתתפות',
}

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'master', // Change this to your database name once created
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true, // For local dev
  },
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

            // Get companies related to this meeting
            const companiesResult = await pool?.request().query(`
                SELECT DISTINCT fid
                FROM [dbEmda].[dbo].[meetingagendaclient]
                WHERE maid IN (SELECT id FROM [dbEmda].[dbo].[meetingagenda] WHERE mid = ${meeting.id})
            `)

            const companies = companiesResult?.recordset

            // For each company, create a vote document
            if (companies)
              for (const company of companies) {
                const mongoCompanyId = companyMap.get(company.fid.toString())

                if (!mongoCompanyId) {
                  console.log(
                    `Company with ID ${company.fid} not found in MongoDB for meeting ${meeting.id}`,
                  )
                  await logMigrationFault({
                    payload,
                    type: 'vote',
                    typeId: `meeting-${meeting.id}-company-${company.fid}`,
                    comments: `Company with ID ${company.fid} not found in MongoDB and votes cannot be migrated for meeting ${meeting.id}`,
                    row: company,
                  })
                  continue
                }

                // Get voting data for this company and meeting
                const votingResult = await pool?.request().query(`
                  SELECT ma.id AS maid,
                         mac.cdecision,
                         mac.comment,
                         mac.ccomment,
                         mac.committee,
                         mac.conflict,
                         mac.relatedParty,
                         mac.pInterest,
                         mac.profFactor
                  FROM [dbEmda].[dbo].[meetingagenda] ma
                           JOIN
                       [dbEmda].[dbo].[meetingagendaclient] mac ON ma.id = mac.maid
                  WHERE ma.mid = ${meeting.id}
                    AND mac.fid = ${company.fid}
                  ORDER BY ma.id
              `)

                const votingData = votingResult?.recordset

                // Create votes array for MongoDB
                // First, create a map of agenda item IDs to their positions in the agenda
                const agendaItemPositions = new Map()
                agendaItems?.forEach((item, index) => {
                  agendaItemPositions.set(item.id, index + 1)
                })

                // Create votes array, preserving the order of agenda topics
                const votes = votingData?.map((vote) => {
                  const voteDecision = votingResultMap[vote.cdecision.toString()] || null

                  // Use the agenda item's position in the agenda as the topicIndex
                  // This preserves the order of topics as they appear in the agenda
                  const topicIndex = agendaItemPositions.get(vote.maid) || vote.maid

                  return {
                    topicIndex,
                    voteDecision,
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
                  votes,
                } as Partial<Vote>
                try {
                  // Create new vote
                  await payload.create({
                    collection: 'votes',
                    data: voteData as Vote,
                    req,
                  })
                  console.log(`✓ Created vote for meeting ${meeting.id} and company ${company.fid}`)
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
