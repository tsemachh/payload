import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import { getCompanyIdToSequenceMap } from '@/utils/utils'
import { Vote } from '@/payload-types'
import { PromisePool } from '@/utils/promisePool'
import { createMSSqlPool } from '@/migrations/utils/utils'
import dotenv from 'dotenv'
import { getMeetingsCutoff } from '@/migrations/utils/dateUtils'

// Load environment variables
dotenv.config()

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
  '17': null, //נמכרה החזקה
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting votes migration process...')
    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for votes.')
      return
    }

    // Get all meetings from MSSQL
    console.log('Executing SQL query for meetings.')
    const { days, dateString } = getMeetingsCutoff()
    const dateCutoff = dateString
    console.log(`Using meetings_days_retro=${days} days; date cutoff: ${dateCutoff}`)
    const request = pool.request()
    request.input('dateCutoff', sql.VarChar, dateCutoff)
    const meetingsResult = await request.query(`
      SELECT id
      FROM [dbEmda].[dbo].[meetings]
      WHERE mdate > @dateCutoff;
    `)

    const meetings = meetingsResult.recordset
    console.log(`Found ${meetings.length} meetings to process`)

    let successCount = 0
    let errorCount = 0
    let skippedNotFoundCount = 0
    let skippedFinalizedCount = 0
    let skippedVotedCount = 0
    // Create a promise pool with 20 concurrent threads
    const promisePool = new PromisePool(20)
    const promises = []
    const companyMap = await getCompanyIdToSequenceMap(payload)

    // Process each meeting in parallel using the promise pool
    for (const meeting of meetings) {
      promises.push(
        promisePool.add(async () => {
          try {
            // Find corresponding meeting in MongoDB by legacyIds and ensure not finalized
            const mongoMeetingRes = await payload.find({
              collection: 'meetings',
              where: {
                and: [
                  { legacyIds: { contains: meeting.id.toString() } },
                ],
              },
              select: { id: true, finalized: true },
              limit: 1,
              depth: 0,
            })

            const mongoMeetingId = mongoMeetingRes?.docs?.[0]?.id
            const mongoMeetingFinalized = mongoMeetingRes?.docs?.[0]?.finalized
            if (!mongoMeetingId) {
              console.warn(
                `Meeting with legacyId ${meeting.id} not found; skipping votes`,
              )
              skippedNotFoundCount++
              await logMigrationFault({
                payload,
                type: 'vote',
                typeId: `meeting-${meeting.id}`,
                comments: `Meeting with legacyId ${meeting.id} not found; votes cannot be migrated`,
                row: meeting,
                severity: 'warning',
              })
              return
            }
            if (mongoMeetingFinalized === true) {
              console.warn(
                `Meeting with legacyId ${meeting.id} is finalized; skipping votes`,
              )
              skippedFinalizedCount++
              await logMigrationFault({
                payload,
                type: 'vote',
                typeId: `meeting-${meeting.id}`,
                comments: `Meeting with legacyId ${meeting.id} is finalized; votes cannot be migrated`,
                row: meeting,
                severity: 'warning',
              })
              return
            }

            // Get agenda items for this meeting
            const agendaRequest = pool?.request()
            agendaRequest?.input('meetingId', sql.Int, meeting.id)
            const agendaResult = await agendaRequest?.query(`
              SELECT id
              FROM [dbEmda].[dbo].[meetingagenda]
              WHERE mid = @meetingId
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
            if (companies) {
              const createdFirmIds: (number | string)[] = []
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
                    severity: 'warning',
                  })
                  continue
                }
                const vote = await payload.find({
                  collection: 'votes',
                  select: { meeting: true },
                  where: {
                    meeting: { equals: mongoMeetingId },
                    company: { equals: mongoCompanyId },
                  },
                  limit: 0,
                  depth: 0,
                })
                if (vote.docs.length > 0) {
                  console.warn(
                    `Vote for company${mongoCompanyId}  and ${mongoMeetingId} already exists`,
                  )
                  skippedVotedCount++
                  continue
                }
                // Get voting data for this company and meeting using stored procedure
                const votingResult = await pool
                  ?.request()
                  .input('mid', sql.Int, meeting.id)
                  .execute('getMeetingAgendaClients')

                // Get voting orders memo from meetingclients table
                const clientsRequest = pool?.request()
                clientsRequest?.input('meetingId', sql.Int, meeting.id)
                clientsRequest?.input('firmId', sql.Int, company.firmid)
                const meetingClientsResult = await clientsRequest?.query(`
                  SELECT [votingOrdersMemo]
                  FROM [dbEmda].[dbo].[meetingclients]
                  WHERE mid = @meetingId
                    AND firmid = @firmId
                `)

                // Filter voting data to get only the votes for the current company
                const votingData = votingResult?.recordset.filter(
                  (vote) => vote.fid === company.firmid,
                )
                const meetingClientsData = meetingClientsResult?.recordset[0]

                // Extract votingOrdersMemo from meetingClients data
                const votingOrdersMemo = meetingClientsData?.votingOrdersMemo

                // Fetch top-level client comment from UserMeetingMessage joined with userstofirms
                const messageRequest = pool?.request()
                messageRequest?.input('meetingId', sql.Int, meeting.id)
                messageRequest?.input('firmId', sql.Int, company.firmid)
                const userMeetingMessageResult = await messageRequest?.query(`
                  SELECT umm.Message
                  FROM
                    [dbEmda].[dbo].[UserMeetingMessage] umm
                    INNER JOIN
                    [dbEmda].[dbo].[userstofirms] utf
                  ON umm.userId = utf.userID
                  WHERE
                    umm.MeetingId = @meetingId
                    AND utf.firmID = @firmId
                `)
                const topLevelClientComment =
                  userMeetingMessageResult?.recordset?.[0]?.Message || ''

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
                  const topicIndex = agendaItemPositions.get(Number(vote.maid)) || vote.maid

                  return {
                    topicIndex,
                    voteDecision,
                    noParticipantDuty,
                    // Map per-topic client comment to schema field 'voteReason'
                    voteReason: vote.ccomment?.trim() || undefined,
                    // Rename booleans to match Votes collection schema
                    isInvestmentCommittee: vote.committee === 1,
                    hasConflictOfInterest: vote.conflict === 1,
                    isRelatedParty: vote.relatedParty === 1,
                    hasPersonalInterest: vote.pInterest === 1,
                  }
                })

                // Create or update vote document in MongoDB
                const voteData = {
                  meeting: mongoMeetingId,
                  company: mongoCompanyId,
                  reported: !!votingOrdersMemo, // Add the votingOrdersMemo field
                  clientComment: topLevelClientComment,
                  votes,
                  _status: 'published',
                } as Partial<Vote>
                try {
                  // Create new vote
                  await payload.create({
                    collection: 'votes',
                    data: voteData as Vote,
                    req: {
                      ...req,
                      context: { ...req.context, from: 'migration', process: 'migrateVotes' },
                    },
                  })
                  createdFirmIds.push(company.firmid)
                  successCount++
                } catch (error: any) {
                  errorCount++
                  console.error(`✗ Failed to process votes for meeting ${meeting.id}:`, error)
                  await logMigrationFault({
                    payload,
                    type: 'vote',
                    severity: 'error',
                    typeId: `meeting-${meeting.id}`,
                    comments: `Failed to process votes for meeting ${meeting.id}: ${error.message}`,
                    row: JSON.stringify(voteData),
                  })
                }
              }

              if (createdFirmIds.length > 0) {
                console.log(
                  `✓ Created vote for meeting ${meeting.id} and companies ${createdFirmIds.join(',')}`,
                )
              }
            }
          } catch (error: any) {
            errorCount++
            console.error(`✗ Failed to process votes for meeting ${meeting.id}:`, error)
            await logMigrationFault({
              payload,
              type: 'vote',
              severity: 'fatal',
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
    console.log(`Skipped (meeting not found): ${skippedNotFoundCount}`)
    console.log(`Skipped (meeting finalized): ${skippedFinalizedCount}`)
    console.log(`Skipped (Vote exists): ${skippedVotedCount}`)
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
