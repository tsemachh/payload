import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql, { IResult } from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { Account, Company, Holding } from '@/payload-types'
import { getStockIdToSequenceMap } from '@/utils/migrateStockUtils'
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

//const DAYS_TO_IMPORT: number = 365 * 7
const START_DATE_TO_IMPORT: string = '2025-01-01'

interface HoldingRow {
  stockNum: string
  firm: string
  qty: number
  subAccountNum: number
  date1: string
  date_update: Date
}

async function getHoldingsCount(pool: sql.ConnectionPool, holdingDate: string): Promise<number> {
  const result = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [date1] = '${holdingDate}'
  `)
  return result.recordset[0].count
}

// Generate array of dates from START_DATE_TO_IMPORT to today
const generateDateArray = (startDateStr: string): string[] => {
  const dates: string[] = []
  const startDate = new Date(startDateStr)
  const today = new Date()

  // If start date is in the future, return empty array
  if (startDate > today) {
    return dates
  }

  // Clone the start date to avoid modifying it
  const currentDate = new Date(startDate)

  // Loop through each day from start date to today
  while (currentDate <= today) {
    // Format date as yyyy-mm-dd
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    dates.push(`${year}-${month}-${day}`)

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

async function getHoldingsPage(
  pool: sql.ConnectionPool,
  holdingDate: string,
): Promise<sql.IResult<HoldingRow>> {
  // Using string interpolation for OFFSET and FETCH parameters to avoid parameter resolution issues
  const result = await pool.request().query(`
      SELECT [stockNum]
           , [firm]
           , [qty]
           , [subAccountNum]
           , [date1]
           , [date_update]
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [date1] = '${holdingDate}'
      ORDER BY [firm], [subAccountNum], [stockNum]
  `)
  return result
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting holdings migration process...')
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    console.log(`Importing holdings from ${START_DATE_TO_IMPORT} date`)

    // Initialize on-demand caches
    const accountCache = new Map<string, string>()
    const stockCache = await getStockIdToSequenceMap(req)
    let successCount = 0
    let errorCount = 0

    const processHoldingsChunk = async (holdings: IResult<HoldingRow>, holdingDate: string) => {
      const companyHoldings = new Map<string, Map<string, number>>()
      //Iterate each row
      for (const holding of holdings.recordset) {
        const accountKey = `${holding.firm}-${holding.subAccountNum}`
        //Find Company id
        const companyId = accountCache.get(accountKey)
        if (!companyId) {
          console.warn(`Company ID not found for account key: ${accountKey}`)
          await logMigrationFault({
            payload,
            type: 'holding',
            row: JSON.stringify(holding),
            typeId: accountKey,
            comments: createErrorFaultComment({
              id: accountKey,
              operation: 'Holdings - Company ID lookup',
              error: new Error(`Company ID not found for account key: ${accountKey}`),
            }),
          })
          continue
        }
        //Find the holding in the map if not found add it to the map
        let quantityPerStockMap: Map<string, number> | undefined = companyHoldings.get(companyId)
        if (!quantityPerStockMap) {
          quantityPerStockMap = new Map<string, number>()
          companyHoldings.set(companyId, quantityPerStockMap)
        }
        const curQuantity = quantityPerStockMap.get(holding.stockNum)
        if (curQuantity) quantityPerStockMap.set(holding.stockNum, curQuantity + holding.qty)
        else quantityPerStockMap.set(holding.stockNum, holding.qty)
      }
      //Iterate Map Values and upsert the Holdings by next logic:
      // Create Holdings Object by filling companyId + valueDate
      // Holdings - for each stock use the stockCache to get the stockId and fill the holdings with stock Id and the quantity
      //If Holding with company and holdingDate exists then update the record
      //Else insert new record with the holdings
      // Convert to array to avoid iterator issues
      for (const [companyId, stocksMap] of Array.from(companyHoldings.entries())) {
        try {
          // Prepare holdings array
          const holdingsArray = []
          for (const [stockNum, quantity] of Array.from(stocksMap.entries())) {
            const stockId = stockCache.get(`${stockNum}`)
            if (stockId) {
              holdingsArray.push({
                quantity,
                stock: stockId,
              })
            } else {
              console.warn(`Stock ID not found for stock number: ${stockNum}`)
            }
          }
          if (holdingsArray.length === 0) {
            console.warn(`No valid stocks found for company: ${companyId}`)
            continue
          }
          //Delete old holdings
          await payload.delete({
            collection: 'holdings',
            req: {
              ...req,
              context: { ...req.context, from: 'migration' },
            },
            where: {
              company: {
                equals: companyId,
              },
              valueDate: {
                equals: holdingDate,
              },
            },
          })

          for (let i = 0; i < holdingsArray.length; i++) {
            const holding = holdingsArray[i]
            // Create holding object
            const holdingData = {
              company: companyId,
              valueDate: holdingDate,
              stock: holding.stock,
              quantity: holding.quantity,
            } as Partial<Holding>
            await payload.create({
              collection: 'holdings',
              data: holdingData as Partial<Holding> as unknown as Holding,
              req: {
                ...req,
                context: { ...req.context, from: 'migration' },
              },
            })
            successCount++
          }
        } catch (error) {
          console.error(`Error processing holdings for company ${companyId}:`, error)
          errorCount++
          await logMigrationFault({
            payload,
            type: 'holding',
            row: '',
            typeId: '',
            comments: createErrorFaultComment({
              id: companyId,
              operation: 'Holdings',
              error: error as Error,
            }),
          })
        }
      }
    }

    // Prefetch common accounts to reduce database lookups
    console.log('Prefetching common accounts...')
    const allAccounts = await payload.find({
      collection: 'accounts',
      limit: 10000,
      where: { isCentralAccount: { equals: true } },
      req,
      depth: 2,
    })

    for (const account of allAccounts.docs) {
      const company = account.company as Company
      if (company?.companyId && account.accountNumber) {
        const accounts = [account.accountNumber]
        if (account?.accounts?.docs) {
          for (let i = 0; i < account?.accounts?.docs?.length; i++) {
            const subAccount: Account = account?.accounts?.docs[i] as Account
            accounts.push(subAccount.accountNumber)
          }
        }
        for (let i = 0; i < accounts.length; i++) {
          const accountNumber = accounts[i]
          const key = `${company.companyId}-${accountNumber}`
          accountCache.set(key, company.id)
          if (
            company?.parentCompany &&
            company.parentCompany.docs &&
            company.parentCompany.docs.length > 0
          ) {
            const parentCompany: Company = company?.parentCompany?.docs[0] as Company
            const key = `${parentCompany.companyId}-${accountNumber}`
            accountCache.set(key, parentCompany.id)
          }
        }
      }
    }
    console.log(`Prefetched ${accountCache.size} accounts`)
    const holdingDates: string[] = generateDateArray(START_DATE_TO_IMPORT)
    console.log(`Generated ${holdingDates.length} dates to process`)

    // Control batch size and parallel processing
    const MAX_CONCURRENT_PROCESSES = 10

    // Process holdings in batches with controlled concurrency
    for (let i = 0; i < holdingDates.length; i += MAX_CONCURRENT_PROCESSES) {
      const batch = []

      // Create a batch of promises up to MAX_CONCURRENT_PROCESSES
      for (let j = 0; j < MAX_CONCURRENT_PROCESSES && i + j < holdingDates.length; j++) {
        const holdingDate = holdingDates[i + j]
        // Get total count
        const totalCount = await getHoldingsCount(pool, holdingDate)
        console.log(`Total holdings to process for ${holdingDate}: ${totalCount}`)

        // Process all pages
        const holdings = await getHoldingsPage(pool, holdingDate)

        // Add to batch
        batch.push(processHoldingsChunk(holdings, holdingDate))
      }

      // Wait for all promises in the current batch to complete
      await Promise.all(batch)
      console.log(
        `Completed batch ${i / MAX_CONCURRENT_PROCESSES + 1} of ${Math.ceil(holdingDates.length / MAX_CONCURRENT_PROCESSES)}`,
      )
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
