import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql, { IResult } from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { Company, Holding } from '@/payload-types'

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
      WHERE [date1] >= '2025-01-01'
  `)
  return result.recordset[0].count
}

async function getHoldingsPage(pool: sql.ConnectionPool, offset: number, pageSize: number): Promise<sql.IResult<HoldingRow>> {
  // Using string interpolation for OFFSET and FETCH parameters to avoid parameter resolution issues
  const result = await pool.request().query(`
      SELECT [stockNum]
           , [firm]
           , [qty]
           , [subAccountNum]
           , [date1]
           , [date_update]
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [date1] >= '2025-01-01'
      ORDER BY [stockNum], [firm], [subAccountNum]          
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
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
      stockId: { equals: `${stockNum}` },
    },
    req,
  })
  return stocks.docs[0]?.id
}

//const DAYS_TO_IMPORT: number = 365 * 7
const DAYS_TO_IMPORT:number = 90
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

    // Increase page size for better performance
    const pageSize = 2500
    let offset = 0;
    let successCount = 0
    let errorCount = 0

    // Initialize on-demand caches
    const accountCache = new Map<string, string>()
    const stockCache = new Map<string, string>()
    const notFoundAccounts = new Set<string>()
    const notFoundStocks = new Set<string>()

    // Prefetch common stocks to reduce database lookups
    console.log('Prefetching common stocks...')
    const commonStocks = await payload.find({
      collection: 'stocks',
      limit: 2500,
      where:{origin:{equals:'TASE'}},
      req,
    })

    for (const stock of commonStocks.docs) {
      if (stock.stockId) {
        stockCache.set(stock.stockId, stock.id)
      }
    }
    console.log(`Prefetched ${stockCache.size} stocks`)

    // Prefetch common accounts to reduce database lookups
    console.log('Prefetching common accounts...')
    const commonAccounts = await payload.find({
      collection: 'accounts',
      limit: 5000,
      req,
    })

    for (const account of commonAccounts.docs) {
      let company = account.company as Company
      if (company?.companyId && account.accountNumber) {
        const key = `${company.companyId}-${account.accountNumber}`
        accountCache.set(key, account.id)
      }
    }
    console.log(`Prefetched ${accountCache.size} accounts`)

    async function processHoldingsChunk(holdings: IResult<HoldingRow>) {
      // Prepare batch operations
      const holdingsBatch: Partial<Holding>[] = []
      const accountsToFetch = new Set<string>()
      const stocksToFetch = new Set<string>()

      // First pass: identify all accounts and stocks we need to fetch
      for (const row of holdings.recordset) {
        const accountKey = `${row.firm}-${row.subAccountNum}`

        if (!accountCache.has(accountKey) && !notFoundAccounts.has(accountKey)) {
          accountsToFetch.add(accountKey)
        }

        if (!stockCache.has(row.stockNum) && !notFoundStocks.has(row.stockNum)) {
          stocksToFetch.add(row.stockNum)
        }
      }

      // Fetch any missing accounts individually
      if (accountsToFetch.size > 0) {
        console.log(`Fetching ${accountsToFetch.size} missing accounts individually`)
        const accountsArray = Array.from(accountsToFetch)

        // Process accounts in smaller batches to avoid overwhelming the system
        const batchSize = 20
        for (let i = 0; i < accountsArray.length; i += batchSize) {
          const batch = accountsArray.slice(i, i + batchSize)
          const accountPromises = batch.map(async (key) => {
            const [firm, subAccountNum] = key.split('-')
            const accountId = await findAccount(payload, firm, parseInt(subAccountNum), req)

            if (accountId) {
              accountCache.set(key, accountId)
            } else {
              notFoundAccounts.add(key)
            }

            return { key, accountId }
          })

          await Promise.all(accountPromises)
        }

        console.log(`Fetched missing accounts. Cache now has ${accountCache.size} accounts`)
      }

      // Fetch any missing stocks individually
      if (stocksToFetch.size > 0) {
        console.log(`Fetching ${stocksToFetch.size} missing stocks individually`)
        const stocksArray = Array.from(stocksToFetch)

        // Process stocks in smaller batches to avoid overwhelming the system
        const batchSize = 20
        for (let i = 0; i < stocksArray.length; i += batchSize) {
          const batch = stocksArray.slice(i, i + batchSize)
          const stockPromises = batch.map(async (stockNum) => {
            const stockId = await findStock(payload, stockNum, req)

            if (stockId) {
              stockCache.set(stockNum, stockId)
            } else {
              notFoundStocks.add(stockNum)
            }

            return { stockNum, stockId }
          })

          await Promise.all(stockPromises)
        }

        console.log(`Fetched missing stocks. Cache now has ${stockCache.size} stocks`)
      }

      // Second pass: prepare holdings batch
      for (const row of holdings.recordset) {
        try {
          const accountKey = `${row.firm}-${row.subAccountNum}`

          // Check if account is known to not exist
          if (notFoundAccounts.has(accountKey)) {
            continue
          }

          let accountId = accountCache.get(accountKey)

          if (!accountId) {
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

          // Check if stock is known to not exist
          if (notFoundStocks.has(row.stockNum)) {
            continue
          }

          let stockId = stockCache.get(row.stockNum)

          if (!stockId) {
            // Try to find the stock
            stockId = await findStock(payload, row.stockNum, req)

            if (stockId) {
              // Add to cache for future use
              stockCache.set(row.stockNum, stockId)
            } else {
              // Mark as not found
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

          // Add to batch
          holdingsBatch.push({
            account: accountId,
            stock: stockId,
            quantity: row.qty,
            valueDate: row.date1,
          })
        } catch (error) {
          errorCount++
          logMigrationFault({
            payload,
            type: 'holding',
            typeId: `${row.firm}-${row.subAccountNum}-${row.stockNum}`,
            comments: createErrorFaultComment({
              operation: 'prepare holding',
              id: `${row.firm}-${row.subAccountNum}-${row.stockNum}`,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
            row: JSON.stringify(row)
          })
        }
      }

      // Process holdings in smaller batches for better performance
      const batchInsertSize = 100
      for (let i = 0; i < holdingsBatch.length; i += batchInsertSize) {
        const batch = holdingsBatch.slice(i, i + batchInsertSize)
        try {
          // Create holdings in batch
          const createPromises = batch.map(data => 
            payload.create({
              collection: 'holdings',
              data: data as Holding,
              req
            })
          )

          await Promise.all(createPromises)

          successCount += batch.length
          console.log(`✓ Processed ${successCount}/${totalCount} holdings`)
        } catch (error) {
          errorCount += batch.length
          console.error('Batch insert error:', error)
        }
      }

      return { success: successCount, errors: errorCount }
    }

    // Process pages in parallel with a concurrency limit
    const concurrencyLimit = 3 // Number of pages to process in parallel

    // Process all pages
    while (offset < totalCount) {
      const pagePromises = []

      // Create a batch of page processing promises
      for (let i = 0; i < concurrencyLimit && offset < totalCount; i++) {
        const currentOffset = offset
        console.log(`Preparing batch: ${currentOffset + 1} to ${Math.min(currentOffset + pageSize, totalCount)}`)

        const pagePromise = (async () => {
          const holdings = await getHoldingsPage(pool, currentOffset, pageSize)
          return processHoldingsChunk(holdings)
        })()

        pagePromises.push(pagePromise)
        offset += pageSize
      }

      // Wait for all pages in this batch to complete
      await Promise.all(pagePromises)
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
    console.log('Performance improvements implemented:')
    console.log('1. Increased page size from 1000 to 2500')
    console.log('2. Implemented parallel processing of pages with concurrency limit of 3')
    console.log('3. Preloaded common accounts and stocks to reduce database lookups')
    console.log('4. Implemented batch inserts for holdings')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}
