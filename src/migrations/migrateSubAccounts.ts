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
  return result.recordset.map((row) => row.TABLE_NAME)
}

async function getSubAccounts(
  pool: sql.ConnectionPool,
  tableName: string,
): Promise<sql.IResult<SubAccountRow>> {
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

      // Group sub-accounts by firmId
      const subAccountsByFirmId = new Map<number, SubAccountRow[]>()

      for (const row of subAccounts.recordset) {
        if (row.accountIdNew == row.accountIdOld) {
          payload.create({
            collection: 'migration-faults',
            data: {
              type: 'account',
              comments: `duplicate accountNumber`,
              row: JSON.stringify(row),
            },
          })
          continue
        }

        if (!subAccountsByFirmId.has(row.firmId)) {
          subAccountsByFirmId.set(row.firmId, [])
        }
        subAccountsByFirmId.get(row.firmId)?.push(row)
      }

      console.log(`Grouped sub-accounts into ${subAccountsByFirmId.size} firms`)

      // Process firms in batches with a promise pool
      const processFirm = async (
        firmId: number,
        firmSubAccounts: SubAccountRow[],
      ): Promise<void> => {
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
            depth: 0,
          })

          if (companyResult.docs.length === 0) {
            // Report to migration faults for all sub-accounts of this firm
            for (const subAccount of firmSubAccounts) {
              await payload.create({
                collection: 'migration-faults',
                data: {
                  type: 'account',
                  comments: `No firm found for firmId: ${firmId}`,
                  row: JSON.stringify(subAccount),
                },
              })
              errorCount++
            }
            return
          }

          // Get the company to check for existing mainAccount
          const company: Company = companyResult.docs[0]
          const companyId = company.id

          // Get the mainAccount array
          const mainAccount = company.mainAccount || []
          let updated = false

          // Process all sub-accounts for this firm
          for (const row of firmSubAccounts) {
            try {
              // Find the mainAccount entry for the parent account
              let mainAccountEntry = mainAccount.find(
                (ma: any) => ma.accountNumber === row.accountIdNew.toString(),
              )

              // If no mainAccount entry exists for the parent account, create one
              if (!mainAccountEntry) {
                mainAccountEntry = {
                  accountNumber: row.accountIdNew.toString(),
                  accountName: `Account ${row.accountIdNew}`,
                  subAccounts: [],
                }
                mainAccount.push(mainAccountEntry)
                updated = true
              }

              // Ensure subAccounts array exists
              if (!mainAccountEntry.subAccounts) {
                mainAccountEntry.subAccounts = []
                updated = true
              }

              // Check if this subaccount already exists in the array
              const subAccountExists = mainAccountEntry.subAccounts.includes(
                row.accountIdOld.toString(),
              )

              if (!subAccountExists) {
                // Add new subaccount
                mainAccountEntry.subAccounts.push(row.accountIdOld.toString())
                updated = true
                console.log(
                  `Added subaccount ${row.accountIdOld} to mainAccount ${row.accountIdNew} for company ${companyId}`,
                )
              }

              successCount++
            } catch (error) {
              console.error(
                `Error processing sub-account ${row.accountIdOld} for firm ${firmId}:`,
                error,
              )
              errorCount++
            }
          }

          // Update company with new mainAccount array only once per firm
          if (updated) {
            await payload.update({
              collection: 'companies',
              id: companyId,
              data: {
                mainAccount,
              },
            })
            console.log(`Updated company ${companyId} with all sub-accounts`)
          }
        } catch (error) {
          console.error(`Error processing firm ${firmId}:`, error)
          errorCount += firmSubAccounts.length
        }
      }

      // Create an array of firms to process
      const firms = Array.from(subAccountsByFirmId.entries())
      const totalFirms = firms.length

      // Set up promise pool with size 20
      const POOL_SIZE = 20

      // Process firms in batches
      for (let i = 0; i < totalFirms; i += POOL_SIZE) {
        console.log(
          `Processing batch ${Math.floor(i / POOL_SIZE) + 1}/${Math.ceil(totalFirms / POOL_SIZE)}`,
        )

        const batch = []

        // Create a batch of promises up to POOL_SIZE
        for (let j = 0; j < POOL_SIZE && i + j < totalFirms; j++) {
          const [firmId, firmSubAccounts] = firms[i + j]
          batch.push(processFirm(firmId, firmSubAccounts))
        }

        // Wait for all promises in the current batch to complete
        await Promise.all(batch)
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
