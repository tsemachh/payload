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
import fs from 'fs'
import path from 'path'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import { fileURLToPath } from 'url'

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
 * 
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


    // After migrating users, create users from test.users.json
    console.log('\n=== Creating Users from test.users.json ===')
    await createUsersFromTestJson({ payload, req })
    console.log('=== Test Users Creation Completed ===\n')

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

    // 8. Migrate Holdings
    console.log('\n=== Starting Holdings Migration ===')
    await migrateHoldings({ payload, req })
    console.log('=== Holdings Migration Completed ===\n')

    // 9. Process Meeting companies
    //TODO

    console.log('migrateAll process completed successfully!')
  } catch (error) {
    console.error('Error during migrateAll process:', error)
    throw error
  }
}

/**
 * Creates users from test.users.json file
 */
async function createUsersFromTestJson({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    // Read the test.users.json file
    const testUsers = [
      {
        "name": "חנה",
        "isAdmin": true,
        "email": "channahk@shefing.com",
        "password": "channahk@shefing.com"
      },
      {
        "name": "אפרת שפריי",
        "isAdmin": true,
        "email": "efrats@shefing.com",
        "password": "efrats@shefing.com"
      },
      {
        "name": "tsemachh",
        "isAdmin": true,
        "email": "tsemachh@shefing.com",
        "password": "tsemachh@shefing.com",
      },
      {
        "name": "shaked",
        "isAdmin": true,
        "email": "shaked@emdaresearch.co.il",
        "password": "shaked@emdaresearch.co.il",
      },
      {
        "name": "mayab",
        "isAdmin": true,
        "email": "mayab@emdaresearch.co.il",
        "password": "mayab@emdaresearch.co.il"
      },
      {
        "name": "philc@shefing.com",
        "isAdmin": true,
        "email": "philc@shefing.com"
      }
    ]

    console.log(`Found ${testUsers.length} users in test.users.json`)

    let createdCount = 0
    let updatedCount = 0
    let errorCount = 0

    // Process each user in the test.users.json file
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await payload.find({
          collection: 'users',
          where: {
            email: {
              equals: userData.email
            }
          }
        })

        if (existingUser.docs.length > 0) {
          // Update existing user
          await payload.update({
            collection: 'users',
            id: existingUser.docs[0].id,
            data: userData
          })
          updatedCount++
          console.log(`✓ Updated test user ${userData.name} (${userData.email})`)
        } else {
          // Create new user
          await payload.create({
            collection: 'users',
            data: userData
          })
          createdCount++
          console.log(`✓ Created test user ${userData.name} (${userData.email})`)
        }
      } catch (error:any) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'user',
          typeId: userData.email,
          comments: `Failed to create/update test user: ${error?.message as string}`,
          row: JSON.stringify(userData, null, 2)
        })
        console.error(`✗ Failed to create/update test user ${userData.name} (${userData.email}):`, error)
      }
    }

    // Print summary
    console.log('\nTest Users Creation Summary:')
    console.log(`✓ Successfully processed users: ${createdCount + updatedCount}`)
    console.log(`  - Created: ${createdCount}`)
    console.log(`  - Updated: ${updatedCount}`)
    console.log(`✗ Failed: ${errorCount}`)
    console.log(`Total processed: ${testUsers.length}`)
  } catch (error) {
    console.error('Error creating users from test.users.json:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
}
