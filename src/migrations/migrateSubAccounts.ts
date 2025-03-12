import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Account } from '@/payload-types'

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'dbEmda',
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
}

interface SubAccountRow {
  firmId: number
  accountIdOld: number
  accountIdNew: number
}

async function getHoldingsTables(pool: sql.ConnectionPool): Promise<string[]> {
  const result = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE 'Holdings%accounts'
  `)
  return result.recordset.map(row => row.TABLE_NAME)
}

async function getSubAccounts(pool: sql.ConnectionPool, tableName: string): Promise<sql.IResult<SubAccountRow>> {
  const result = await pool.request().query(`
    SELECT 
      [firm_id] as firmId,
      [account_id_old] as accountIdOld,
      [account_id_new] as accountIdNew
    FROM [dbEmda].[dbo].[${tableName}]
  `)
  return result
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting sub-accounts migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Get all Holdings tables
    const holdingsTables = await getHoldingsTables(pool)
    console.log(`Found ${holdingsTables.length} Holdings tables`)

    let successCount = 0
    let errorCount = 0

    // Process each Holdings table
    for (const tableName of holdingsTables) {
      console.log(`Processing table: ${tableName}`)
      const subAccounts = await getSubAccounts(pool, tableName)

      for (const row of subAccounts.recordset) {
        try {
          // Find the firm
          const companyResult = await payload.find({
            collection: 'companies',
            where: {
              companyId: {
                equals: row.firmId
              }
            }
          })

          if (companyResult.docs.length === 0) {
            // Report to migration faults
            payload.create({
              collection: 'migration-faults',
              data: {
                type: 'account',
                comments: `No firm found for firmId: ${row.firmId}`,
                row: JSON.stringify(row)
              }
            })
            errorCount++
            continue
          }

          const companyId = companyResult.docs[0].id

          // Find the parent account (accountIdNew)
          const parentAccountResult = await payload.find({
            collection: 'accounts',
            where: {
              and: [
                {
                  accountNumber: {
                    equals: row.accountIdNew
                  }
                },
                {
                  company: {
                    equals: companyId
                  }
                }
              ]
            }
          })

          if (parentAccountResult.docs.length === 0) {
            // Report to migration faults
             payload.create({
              collection: 'migration-faults',
              data: {
                type: 'account',
                comments: `No parent account found: ${row.accountIdNew} for firm: ${row.firmId}`,
                row: JSON.stringify(row)
              }
            })
            errorCount++
            continue
          }

          const parentAccountId = parentAccountResult.docs[0].id

          // Create sub-account
          const accountData: Partial<Account> = {
            accountNumber: row.accountIdOld,
            name: `Sub Account ${row.accountIdOld}`,
            company: companyId,
            isCentralAccount: false,
            parentAccount: parentAccountId
          }

          // Check if sub-account already exists
          const existingAccount = await payload.find({
            collection: 'accounts',
            where: {
              and: [
                {
                  accountNumber: {
                    equals: row.accountIdOld
                  }
                },
                {
                  company: {
                    equals: companyId
                  }
                }
              ]
            }
          })

          if (existingAccount.docs.length > 0) {
            // Update existing sub-account
            payload.update({
              collection: 'accounts',
              id: existingAccount.docs[0].id,
              data: accountData
            })
            console.log(`Updated sub-account: ${row.accountIdOld} for firm: ${row.firmId}`)
          } else {
            // Create new sub-account
            payload.create({
              collection: 'accounts',
              data: accountData as Account
            })
            console.log(`Created new sub-account: ${row.accountIdOld} for firm: ${row.firmId}`)
          }

          successCount++
        } catch (error) {
          console.error(`Error processing sub-account ${row.accountIdOld} for firm ${row.firmId}:`, error)
          errorCount++
        }
      }
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
      console.log('SQL connection closed')
    }
  }
}