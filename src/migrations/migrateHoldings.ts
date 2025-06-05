import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql, { IResult } from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
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
    console.log('Starting holding days migration process...')
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    console.log(`Importing holding days from ${START_DATE_TO_IMPORT} date`)

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
    console.log('Silent Stock Set size is:' + silentStockSet.size)

    const processHoldingsChunk = async (holdings: IResult<HoldingRow>, holdingDate: string) => {
      const companyHoldings = new Map<string, Map<string, { stockId: string, quantity: number, feedStockNum: string }>>()
      
      // Iterate each row
      for (const holding of holdings.recordset) {
        const accountKey = `${holding.firm}-${holding.subAccountNum}`
        // Find Company id
        const companyId = accountCache.get(accountKey)
        if (!companyId) {
          console.warn(`Company ID not found for account key: ${accountKey}`)
          await logMigrationFault({
            payload,
            type: 'holding-day',
            row: JSON.stringify(holding),
            typeId: accountKey,
            comments: createErrorFaultComment({
              id: accountKey,
              operation: 'HoldingDay - Company ID lookup',
              error: new Error(`Company ID not found for account key: ${accountKey}`),
            }),
          })
          continue
        }
        
        // Find the holding in the map if not found add it to the map
        let stocksMap = companyHoldings.get(companyId)
        if (!stocksMap) {
          stocksMap = new Map<string, { stockId: string, quantity: number, feedStockNum: string }>()
          companyHoldings.set(companyId, stocksMap)
        }
        
        const stockId = stockCache.get(`${holding.stockNum}`)
        if (!stockId) {
          if (!silentStockSet.has(`${holding.stockNum}`)) {
            console.warn(`Stock ID not found for stock number: ${holding.stockNum}`)
          }
          continue
        }
        
        const existingHolding = stocksMap.get(holding.stockNum)
        if (existingHolding) {
          existingHolding.quantity += holding.qty
        } else {
          stocksMap.set(holding.stockNum, {
            stockId,
            quantity: holding.qty,
            feedStockNum: holding.stockNum
          })
        }
      }
      
      // Process each company's holdings for the day
      for (const [companyId, stocksMap] of Array.from(companyHoldings.entries())) {
        try {
          // Prepare holdings array
          const holdingsArray = []
          for (const [_, holdingData] of Array.from(stocksMap.entries())) {
            holdingsArray.push({
              stock: holdingData.stockId,
              quantity: holdingData.quantity,
              feedStockNum: holdingData.feedStockNum
            })
          }
          
          if (holdingsArray.length === 0) {
            console.warn(`No valid stocks found for company: ${companyId}`)
            continue
          }
          
          // Delete old holding day if exists
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
          
          // Create new holding day with all stocks
          const holdingDayData = {
            fund: companyId,
            valueDate: holdingDate,
            holdings: holdingsArray
          }
          
          await payload.create({
            collection: 'holdings',
            data: holdingDayData,
            req: {
              ...req,
              context: { ...req.context, from: 'migration' },
            },
          })
          
          successCount++
        } catch (error) {
          console.error(`Error processing holding day for company ${companyId}:`, error)
          errorCount++
          await logMigrationFault({
            payload,
            type: 'holding-day',
            row: '',
            typeId: '',
            comments: createErrorFaultComment({
              id: companyId,
              operation: 'HoldingDay',
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
      where: {
        type: { equals: 'fund' }
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