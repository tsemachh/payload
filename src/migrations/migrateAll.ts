import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { up as migrateStocks } from './migrateStocks'
import { migrateDual, up as migrateForeign } from './migrateForeign'
import { up as migrateFullMeetings } from './migrateFullMeeting'
import { up as migrateUsers } from './migrateUsers'
import { up as migrateHoldings } from './migrateHoldings'
import { up as migrateFullFirms } from './migrateFullFirms'

import { up as migrateVotes } from './migrateVotes'
import { up as migrateRecommendationReasons } from './migrateRecommendationReasons'
import { up as migrateMeetingHoldings } from './migrateMeetingHoldings'
import { processCompaniesMeetings } from '@/collections/meetings/hooks/processCompaniesMeetings'

/**
 * Migrates all collections in the following order:
 * 1. Stocks
 * 2. Foreign
 * 3. Meetings (includes Silenced Stocks Companies migration)
 * 4. Firms
 * 5. Users
 * 8. Holdings
 * 12. Votes
 * 13. Recommendation Reasons
 * 14. Unify Meetings (removes duplicate meetings and merges their data)
 * 15. Meeting Holdings (updates meetings with holdings data from MSSQL)
 * 16. Process Companies Meetings
 *
 * Note: Other migrations are currently commented out in the code.
 * For users migration, it also creates users from test.users.json after migrating users.
 * The Silenced Stocks Companies migration (which stores silenced stocks directly in companies collection)
 * is now part of the Meetings migration.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting migrateAll process...')

  try {
    // 1. Migrate Stocks
    console.log('\n=== Starting Stocks Migration ===')
    await migrateStocks({ payload, req })
    console.log('=== Stocks Migration Completed ===\n')

    // 2. Migrate Meetings
    console.log('\n=== Starting Meetings Migration ===')
    await migrateFullMeetings({ payload, req })
    console.log('=== Meetings Migration Completed ===\n')

    // 2. Migrate Firsm
    console.log('\n=== Starting Firms Migration ===')
    await migrateFullFirms({ payload, req })
    console.log('=== Meetings Firms Completed ===\n')

    // 3. Migrate Foreign
    console.log('\n=== Starting Foreign Stocks Migration ===')
    await migrateForeign({ payload, req })
    console.log('=== Foreign Stocks Migration Completed ===\n')

    // 4. Migrate Dual-Listed Stocks
    console.log('\n=== Starting Dual-Listed Stocks Migration ===')
    await migrateDual({ payload, req })
    console.log('=== Dual-Listed Stocks Migration Completed ===\n')

    // 5. Migrate Users
    console.log('\n=== Starting Users Migration ===')
    await migrateUsers({ payload, req })
    console.log('=== Users Migration Completed ===\n')

    // 11. Migrate Holdings
    console.log('\n=== Starting Holdings Migration ===')
    await migrateHoldings({ payload, req })
    console.log('=== Holdings Migration Completed ===\n')

    // 17. Migrate Meeting Holdings
    console.log('\n=== Starting Meeting Holdings Migration ===')
    await migrateMeetingHoldings({ payload, req })
    console.log('=== Meeting Holdings Migration Completed ===\n')

    // 14. Migrate Votes
    console.log('\n=== Starting Votes Migration ===')
    await migrateVotes({ payload, req })
    console.log('=== Votes Migration Completed ===\n')

    // 15. Migrate Recommendation Reasons
    console.log('\n=== Starting Recommendation Reasons Migration ===')
    await migrateRecommendationReasons({ payload, req })
    console.log('=== Recommendation Reasons Migration Completed ===\n')

    //16. Unify Meetings
    //    console.log('\n=== Starting Unify Meetings Migration ===')
    //    await unifyMeetings({ payload, req })
    //    console.log('=== Unify Meetings Migration Completed ===\n')

    // 18. Migrate processCompaniesMeetings
    console.log('\n=== Starting processCompaniesMeetings ===')
    await processCompaniesMeetings(req)
    console.log('=== processCompaniesMeetings Completed ===\n')
    console.log('migrateAll process completed successfully!')
  } catch (error) {
    console.error('Error during migrateAll process:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
}
