import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Company } from '@/payload-types'

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

    // Group accounts by firmId
    const accountsByFirmId = new Map<number, AccountRow[]>()

    for (const row of resultAccounts.recordset) {
      if (!accountsByFirmId.has(row.firmId)) {
        accountsByFirmId.set(row.firmId, [])
      }
      accountsByFirmId.get(row.firmId)?.push(row)
    }

    console.log(`Grouped accounts into ${accountsByFirmId.size} firms`)

    // Process each firm once
    for (const [firmId, accounts] of accountsByFirmId.entries()) {
      try {
        // Find the firm
        const companyResult = await payload.find({
          collection: 'companies',
          where: {
            companyId: {
              equals: firmId,
            },
          },
          limit: 1,
        })

        if (companyResult.docs.length === 0) {
          console.error(`No firm found for firmId: ${firmId}`)
          // Report to migration faults for all accounts of this firm
          for (const account of accounts) {
            await payload.create({
              collection: 'migration-faults',
              data: {
                type: 'account',
                comments: `No firm found for firmId: ${firmId}`,
                row: JSON.stringify(account),
                typeId: `${account.accountNumber}`,
              },
            })
            errorCount++
          }
          continue
        }

        const theCompany: Company = companyResult.docs[0]
        const companyId = theCompany.id

        // Get existing mainAccount array or initialize empty array
        const mainAccount = theCompany.mainAccount || []

        // Add all accounts for this firm
        for (const account of accounts) {
          mainAccount.push({
            accountNumber: account.accountNumber.toString(),
            accountName: account.name || `Account ${account.accountNumber}`,
          })
          successCount++
        }

        // Update company with all mainAccount entries at once
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            mainAccount,
          },
        })

        console.log(`Updated company ${companyId} with ${accounts.length} mainAccount entries`)
      } catch (error) {
        console.error(`Error processing accounts for firm ${firmId}:`, error)
        errorCount += accounts.length
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
