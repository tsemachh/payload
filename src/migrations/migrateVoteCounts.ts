import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { recalculateMeetingVoteCounts } from '@/collections/meetings/hooks/votesCountHooks'

/**
 * Migration script to calculate initial vote counts for existing meetings
 * This script:
 * 1. Finds all existing meetings
 * 2. For each meeting, counts published votes and reported votes
 * 3. Updates the meeting with the calculated counts
 * 4. Recalculates status indicators based on the counts
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting vote counts migration...')

  try {
    // Get all meetings
    const { docs: meetings } = await payload.find({
      collection: 'meetings',
      select: { _status: true },
      limit: 0, // Adjust as needed
      depth: 0,
    })

    console.log(`Found ${meetings.length} meetings to process`)

    // Process each meeting
    for (const meeting of meetings) {
      try {
        await recalculateMeetingVoteCounts(req.payload, meeting.id)
      } catch (error) {
        console.error(`Error processing meeting ${meeting.id}:`, error)
      }
    }

    console.log('Vote counts migration completed successfully')
  } catch (error) {
    console.error('Error during vote counts migration:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {}
