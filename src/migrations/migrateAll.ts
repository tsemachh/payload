import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { up as migrateStocks } from './migrateStocks'
import { up as migrateForeign } from './migrateForeign'
import { up as migrateMeetings } from './migrateMeetings'
import { up as migrateFirms } from './migrateFirms'
import { up as migrateUsers } from './migrateUsers'
import { up as migrateAccounts } from './migrateAccounts'
import { up as migrateSubAccounts } from './migrateSubAccounts'
import { up as migrateHoldings } from './migrateHoldings'
import { up as migrateParentCompanies } from './migrateParentCompanies'
import { up as migrateAccountCompaniesToCompanies } from './migrateAccountCompaniesToCompanies'
import { up as migrateSilencedStocksCompanies } from './migrateSilencedStocksCompanies'
import { up as migrateMeetingAgenda } from './migrateMeetingAgenda'
import { up as migrateVotes } from './migrateVotes'
import { processCompaniesMeetings } from '@/collections/companies-meetings/utils/processCompaniesMeetings'

/**
 * Migrates all collections in the following order:
 * 1. Stocks
 * 2. Foreign
 * 3. Meetings
 * 4. Firms
 * 5. Users
 * 6. Accounts
 * 7. Sub Accounts
 * 8. Holdings
 * 9. Parent Companies
 * 10. Account Companies To Companies
 * 11. Silenced Stocks Companies (stores silenced stocks directly in companies collection)
 * 12. Meeting Agenda
 * 13. Votes
 * 14. Process Companies Meetings
 * 
 * Note: Other migrations are currently commented out in the code.
 * For users migration, it also creates users from test.users.json after migrating users.
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
    await migrateMeetings({ payload, req })
    console.log('=== Meetings Migration Completed ===\n')

    // 3. Migrate Foreign
    console.log('\n=== Starting Foreign Stocks Migration ===')
    await migrateForeign({ payload, req })
    console.log('=== Foreign Stocks Migration Completed ===\n')

    // 4. Migrate Firms
    console.log('\n=== Starting Firms Migration ===')
    await migrateFirms({ payload, req })
    console.log('=== Firms Migration Completed ===\n')

    // 5. Migrate Users
    console.log('\n=== Starting Users Migration ===')
    await migrateUsers({ payload, req })
    console.log('=== Users Migration Completed ===\n')

    // 6. Migrate Accounts
    console.log('\n=== Starting Accounts Migration ===')
    await migrateAccounts({ payload, req })
    console.log('=== Accounts Migration Completed ===\n')

    // 7. Migrate Sub Accounts
    console.log('\n=== Starting Sub Accounts Migration ===')
    await migrateSubAccounts({ payload, req })
    console.log('=== Sub Accounts Migration Completed ===\n')

    // 9. Migrate Parent Companies
    console.log('\n=== Starting Parent Companies Migration ===')
    await migrateParentCompanies({ payload, req })
    console.log('=== Parent Companies Migration Completed ===\n')



    // 10. Migrate Account Companies To Companies
    console.log('\n=== Starting Account Companies To Companies Migration ===')
    await migrateAccountCompaniesToCompanies({ payload, req })
    console.log('=== Account Companies To Companies Migration Completed ===\n')


    // 11. Migrate Holdings
    console.log('\n=== Starting Holdings Migration ===')
    await migrateHoldings({ payload, req })
    console.log('=== Holdings Migration Completed ===\n')

    //  12. Process silenced stocks - match them to companies and store in companies collection
    console.log('\n=== Starting Silenced Stocks Companies Migration ===')
    await migrateSilencedStocksCompanies({ payload, req })
    console.log('=== Silenced Stocks Companies Migration Completed ===\n')

    // 13. Migrate Meeting Agenda
    console.log('\n=== Starting Meeting Agenda Migration ===')
    await migrateMeetingAgenda({ payload, req })
    console.log('=== Meeting Agenda Migration Completed ===\n')

    // 14. Migrate Votes
    console.log('\n=== Starting Votes Migration ===')
    await migrateVotes({ payload, req })
    console.log('=== Votes Migration Completed ===\n')

    // 15. Migrate processCompaniesMeetings
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
