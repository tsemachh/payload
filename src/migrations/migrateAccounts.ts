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
    trustServerCertificate: true,
  },
}

interface AccountRow {
  accountNumber: number
  name: string
  firmId: number
}

async function getAccounts(pool: sql.ConnectionPool): Promise<sql.IResult<AccountRow>> {
  const result = await pool.request().query(`
      SELECT [firmID]      as firmId,
             [accountNum]  as accountNumber,
             [accountName] as name
      FROM [dbEmda].[dbo].[clientsubaccounts]
      ORDER BY [firmID], [accountNum]
  `)
  return result
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting accounts migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Get accounts data from SQL Server
    const resultAccounts = await getAccounts(pool)
    console.log(`Retrieved ${resultAccounts.recordset.length} accounts from SQL Server`)

    let successCount = 0
    let errorCount = 0

    for (const row of resultAccounts.recordset) {
      try {
        // Find or create the firm
        const firmResult = await payload.find({
          collection: 'firms',
          where: {
            firmId: {
              equals: row.firmId,
            },
          },
        })

        if (firmResult.docs.length === 0) {
          console.error(`No firm found for firmId: ${row.firmId}`)
          // Report to migration faults
          await payload.create({
            collection: 'migration-faults',
            data: {
              type: 'account',
              comments: `No firm found for firmId: ${row.firmId}`,
              row: JSON.stringify(row),
              typeId: `${row.accountNumber}`
            }
          })
          errorCount++
          continue
        }

        const firmId = firmResult.docs[0].id

        // Check if account exists for this firm
        const existingAccount = await payload.find({
          collection: 'accounts',
          where: {
            accountNumber: {
              equals: row.accountNumber,
            },
            firm: {
              equals: firmId,
            },
          },
        })

        const accountData: Partial<Account> = {
          accountNumber: row.accountNumber,
          name: row.name,
          firm: firmId,
          isCentralAccount : true
        }

        if (existingAccount.docs.length > 0) {
          // Update existing account
          await payload.update({
            collection: 'accounts',
            id: existingAccount.docs[0].id,
            data: accountData,
          })
          console.log(`Updated account: ${row.accountNumber} for firm: ${row.firmId}`)
        } else {
          // Create new account
          await payload.create({
            collection: 'accounts',
            data: accountData as Account,
          })
          console.log(`Created new account: ${row.accountNumber} for firm: ${row.firmId}`)
        }

        successCount++
      } catch (error) {
        console.error(
          `Error processing account ${row.accountNumber} for firm ${row.firmId}:`,
          error,
        )
        errorCount++
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

/**/
