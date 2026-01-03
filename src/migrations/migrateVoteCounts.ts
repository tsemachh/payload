import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'
import { PromisePool } from '@/utils/promisePool'
import { withTimeout } from '@/utils/withTimeout'

/**
 * Migration script to calculate initial vote counts for existing meetings
 * This script:
 * 1. Finds all existing meetings
 * 2. For each meeting, counts published votes and reported votes
 * 3. Updates the meeting with the calculated counts
 * 4. Recalculates status indicators based on the counts
 * 5. Runs in parallel with a pool size of 20 using the PromisePool utility
 * 6. Tracks statistics for the operation
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting vote counts migration...')

  req = {
    ...req,
    context: { ...req.context, from: 'migration', process: 'migrateVotesCount' },
  }
  // Statistics tracking
  const stats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    startTime: Date.now(),
    endTime: 0,
    durationMs: 0,
  }

  try {
    // Get all meetings
    const { docs: meetings } = await payload.find({
      collection: 'meetings',
      select: { _status: true },
      where: { finalized: { equals: false } },
      limit: 0,
      depth: 0,
    })

    stats.total = meetings.length
    console.log(`Found ${meetings.length} meeting to process`)

    // Process meetings in parallel with a pool size of 20
    const POOL_SIZE = 20
    const pool = new PromisePool(POOL_SIZE)
    const results: Array<{ success: boolean; meetingId: string; result?: any; error?: any }> =
      new Array(meetings.length)

    // Collect meetings where votes > companies
    const meetingIdsNeedingCompaniesProcessing: string[] = []

    // Add all meetings to the pool
    const promises = meetings.map((meeting, index) => {
      return pool.add(async () => {
        try {
          // Add detailed logging for debugging hangs
          if (meetings.length > 100 && index % 10 === 0) {
            console.log(
              `[${new Date().toISOString()}] Processing meeting ${index + 1}/${meetings.length}: ${meeting.id}`,
            )
          }

          const result = await withTimeout(
            recalculateMeetingVoteCounts(req, meeting.id),
            180000,
            `Timeout recalculating vote counts for meeting ${meeting.id} after 180s`,
          )
          if (result?.data?.votesExceedCompanies) {
            meetingIdsNeedingCompaniesProcessing.push(meeting.id)
          }
          results[index] = { success: true, meetingId: meeting.id, result }
        } catch (error) {
          console.error(`Error processing meeting ${meeting.id}:`, error)
          results[index] = { success: false, meetingId: meeting.id, error }
        } finally {
          // Update progress
          stats.processed++
          if (stats.processed % 10 === 0 || stats.processed === meetings.length) {
            const percentComplete = ((stats.processed / meetings.length) * 100).toFixed(1)
            console.log(
              `[${new Date().toISOString()}] Progress: ${stats.processed}/${meetings.length} (${percentComplete}%)`,
            )
          }
        }
      })
    })

    // Wait for all promises to complete
    await Promise.all(promises)
    await pool.waitForAll()

    // Post-processing: clean up votes for meetings where votes > companies
    if (meetingIdsNeedingCompaniesProcessing.length > 0) {
      // Lazy import to avoid circular deps at module load time
      const { cleanupInvalidVotesForMeetings } = await import(
        '@/collections/meetings/hooks/processCompaniesMeetings'
      )

      await cleanupInvalidVotesForMeetings(
        {
          ...req,
          context: { ...req.context, from: 'migration', process: 'migrateVotesCount' },
        } as any,
        meetingIdsNeedingCompaniesProcessing,
      )
      console.log(
        'Completed cleanupInvalidVotesForMeetings for meetings with votes > companies. Count:',
        meetingIdsNeedingCompaniesProcessing.length,
      )
    } else {
      console.log(
        'No meetings had votes > companies. Skipping cleanupInvalidVotesForMeetings call.',
      )
    }

    // Update final statistics
    stats.successful = results.filter((r) => r.success).length
    stats.failed = results.filter((r) => !r.success).length
    stats.endTime = Date.now()
    stats.durationMs = stats.endTime - stats.startTime

    // Log statistics
    console.log('Vote counts migration completed successfully')
    console.log('Statistics:')
    console.log(`- Total meetings: ${stats.total}`)
    console.log(`- Successfully processed: ${stats.successful}`)
    console.log(`- Failed: ${stats.failed}`)
    console.log(`- Duration: ${(stats.durationMs / 1000).toFixed(2)} seconds`)
    console.log(
      `- Average processing time: ${(stats.durationMs / stats.total).toFixed(2)} ms per meeting`,
    )
  } catch (error) {
    console.error('Error during vote counts migration:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {}
