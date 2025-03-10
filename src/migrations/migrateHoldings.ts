import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { Holding } from '@/payload-types'

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
  requestTimeout: 3600000, // Increase timeout globally to 120 seconds
}

interface HoldingRow {
  stockNum: string
  firm: string
  qty: number
  subAccountNum: number
  date1: string
  date_update: Date
}

async function getHoldingsCount(pool: sql.ConnectionPool): Promise<number> {
  const result = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [date1] >= DATEADD(day, -${DAYS_TO_IMPORT}, GETDATE())
  `)
  return result.recordset[0].count
}

async function getHoldingsPage(pool: sql.ConnectionPool, offset: number, pageSize: number): Promise<sql.IResult<HoldingRow>> {
  const result = await pool.request()
    .input('offsetRows', sql.Int, offset)
    .input('fetchRows', sql.Int, pageSize)
    .query(`
      SELECT [stockNum]
           , [firm]
           , [qty]
           , [subAccountNum]
           , [date1]
           , [date_update]
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [date1] >= DATEADD(DAY, -${DAYS_TO_IMPORT}, GETDATE())
      ORDER BY [stockNum], [firm], [subAccountNum]          
      OFFSET @offsetRows ROWS
      FETCH NEXT @fetchRows ROWS ONLY
    `)
  return result
}


async function findAccount(payload: any, firm: string, subAccountNum: number, req: any) {
  const accounts = await payload.find({
    collection: 'accounts',
    where: {
      'company.companyId': { equals: firm },
      accountNumber: { equals: subAccountNum },
    },
    req,
  })
  return accounts.docs[0]?.id
}

async function findStock(payload: any, stockNum: string, req: any) {
  const stocks = await payload.find({
    collection: 'stocks',
    where: {
      stockId: { equals: stockNum },
    },
    req,
  })
  return stocks.docs[0]?.id
}

//const DAYS_TO_IMPORT: number = 365 * 7
const DAYS_TO_IMPORT:number = 30
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting holdings migration process...')
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    console.log(`Importing holdings for the last ${DAYS_TO_IMPORT} days`)

    // Get total count
    const totalCount = await getHoldingsCount(pool)
    console.log(`Total holdings to process: ${totalCount}`)

    const pageSize = 1000
    let offset = 0;//0 //TODO change back to 0
    let successCount = 0
    let errorCount = 0

    // Initialize on-demand caches
    const accountCache = new Map<string, string>()
    const stockCache = new Map<string, string>()
    const notFoundAccounts = new Set<string>()
    const notFoundStocks = new Set<string>()

    while (offset < totalCount) {
      console.log(`Processing batch: ${offset + 1} to ${Math.min(offset + pageSize, totalCount)}`)
      const holdings = await getHoldingsPage(pool, offset, pageSize)

      for (const row of holdings.recordset) {
        try {
          // Get account from cache or find it
          const accountKey = `${row.firm}-${row.subAccountNum}`

          // Check if account is known to not exist
          if (notFoundAccounts.has(accountKey)) {
            continue
          }

          let accountId = accountCache.get(accountKey)

          if (accountId === undefined) {
            accountId = await findAccount(payload, row.firm, row.subAccountNum, req)
            if (accountId) {
              accountCache.set(accountKey, accountId as string)
            } else {
              notFoundAccounts.add(accountKey)
              logMigrationFault({
                payload,
                type: 'holding',
                typeId: accountKey,
                comments: `Account not found for firm: ${row.firm}, account number: ${row.subAccountNum}`,
                row: JSON.stringify(row),
              })
              continue
            }
          }

          // Get stock from cache or find it
          // Check if stock is known to not exist
          if (notFoundStocks.has(row.stockNum)) {
            continue
          }

          let stockId = stockCache.get(row.stockNum)

          if (stockId === undefined) {
            stockId = await findStock(payload, row.stockNum, req)
            if (stockId) {
              stockCache.set(row.stockNum, stockId as string)
            } else {
              notFoundStocks.add(row.stockNum)
              logMigrationFault({
                payload,
                type: 'holding',
                typeId: row.stockNum,
                comments: `Stock not found with ID: ${row.stockNum}`,
                row: JSON.stringify(row),
              })
              continue
            }
          }

          const data: Partial<Holding> = {
            account: accountId,
            stock: stockId,
            quantity: row.qty,
            valueDate: row.date1,
          }

          // Create holding
          payload.create({
            collection: 'holdings',
            data: data as Holding,
            req
          })

          successCount++
          if (successCount % 100 === 0) {
            console.log(`✓ Processed ${successCount}/${totalCount} holdings`)
          }
        } catch (error) {
          errorCount++
          logMigrationFault({
            payload,
            type: 'holding',
            typeId: `${row.firm}-${row.subAccountNum}-${row.stockNum}`,
            comments: createErrorFaultComment({
              operation: 'insert holding',
              id: `${row.firm}-${row.subAccountNum}-${row.stockNum}`,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
            row: JSON.stringify(row)
          })
        }
      }

      offset += pageSize
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}
