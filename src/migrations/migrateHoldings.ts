import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql, { IResult } from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { Holding } from '@/payload-types'
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
const START_DATE_TO_IMPORT: string = '01-05-2025'

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
  // Parse date in MM-DD-YYYY format
  const [month, day, year] = startDateStr.split('-').map(Number)
  const startDate = new Date(year, month - 1, day)
  const today = new Date()

  // If start date is in the future, return empty array
  if (startDate > today) {
    return dates
  }

  // Clone the start date to avoid modifying it
  const currentDate = new Date(startDate)

  // Loop through each day from start date to today
  while (currentDate <= today) {
    // Format date as mm-dd-yyyy
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    dates.push(`${month}-${day}-${year}`)

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

    const silencedStocks = await payload.find({
      collection: 'silenced-stocks',
      select: {
        stockId: true,
      },
      limit: 0,
      req,
    })
    const silentStockSet = new Set<string>()
    silencedStocks.docs.forEach((doc) => {
      silentStockSet.add(`${doc.stockId}`)
    })
    console.log('Silent Stock Set size is:'+silentStockSet.size)
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
                feedStockNum:stockNum
              })
            } else {
              if (!silentStockSet.has(`${stockNum}`)) {
                console.warn(`Stock ID not found for stock number: ${stockNum}`)
              }
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
              fund: {
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
              fund: companyId,
              valueDate: holdingDate,
              stock: holding.stock,
              quantity: holding.quantity,
              feedStockNum: holding.feedStockNum,
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

    // Prefetch companies with account information
    console.log('Prefetching companies with account information...')
    const allCompanies = await payload.find({
      collection: 'companies',
      limit: 0,
      where:{
        type: {equals:'fund'}
      },
      req,
      depth: 0,
    })

    allCompanies.docs.forEach((company) => {
      const parentCompanyId: string | null = company.legacyCompanyId as string | null
      if (company.mainAccount && Array.isArray(company.mainAccount)) {
        company.mainAccount.forEach((account) => {
          if (parentCompanyId) {
            const key = `${parentCompanyId}-${account.accountNumber}`
            accountCache.set(key, company.id)
          }
        })
      }
    })
    console.log(`Prefetched ${accountCache.size} accounts`)
    const holdingDates: string[] = generateDateArray(START_DATE_TO_IMPORT)
    console.log(`Generated ${holdingDates.length} dates to process`)
    debugger
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
