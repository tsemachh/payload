import { createMSSqlPool, sqlConfig } from '@/migrations/utils/utils'
import { getStockIdToSequenceMap } from '@/utils/migrateStockUtils'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import sql, { IResult } from 'mssql'
import { MigrateUpArgs } from '@payloadcms/db-mongodb'

interface HoldingRow {
  stockNum: string
  firm: string
  qty: number
  subAccountNum: number
  date1: string
  date_update: Date
}

// Format date to MM-DD-YYYY format
function formatDateForSQL(dateStr: string): string {
  // If the date is already in MM-DD-YYYY format, return it
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    return dateStr
  }

  // Parse the date string
  const date = new Date(dateStr)

  // Format to MM-DD-YYYY
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()

  return `${month}-${day}-${year}`
}

async function getHoldingsPage(
  pool: sql.ConnectionPool,
  firm: string,
  latestDate: string,
): Promise<sql.IResult<HoldingRow>> {
  // Format the date for SQL query
  const formattedDate = formatDateForSQL(latestDate)

  const result = await pool.request().query(`
      SELECT [stockNum]
           , [firm]
           , [qty]
           , [subAccountNum]
           , [date1]
           , [date_update]
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [firm] = '${firm}' AND [date1] = '${formattedDate}'
      ORDER BY [subAccountNum], [stockNum]
  `)
  return result
}

async function getActiveCompaniesWithLatestDate(
  pool: sql.ConnectionPool,
): Promise<{ firm: string; latest_date1: string; name: string }[]> {
  const result = await pool.request().query(`
      SELECT h.firm, MAX(h.date1) AS latest_date1, f.name
      FROM [${sqlConfig.database}].[dbo].[holdings] h
      INNER JOIN [${sqlConfig.database}].[dbo].[firms] f ON h.firm = f.id
      WHERE h.qty IS NOT NULL AND h.qty <> 0 AND f.firm_active = 1
      GROUP BY h.firm, f.name
      ORDER BY h.firm
  `)
  return result.recordset
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting holding days migration process...')
    pool = await createMSSqlPool()
    console.log('Importing latest holdings for all active companies')

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
      const companyHoldings = new Map<
        string,
        Map<string, { stockId: string; quantity: number; feedStockNum: string }>
      >()

      // Iterate each row
      for (const holding of holdings.recordset) {
        const accountKey = `${holding.firm}-${holding.subAccountNum}`
        // Find Company id
        const companyId = accountCache.get(accountKey)
        if (!companyId) {
          //console.warn(`Company ID not found for account key: ${accountKey}`)
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

        // Find the holding in the map if not found add it to the map
        let stocksMap = companyHoldings.get(companyId)
        if (!stocksMap) {
          stocksMap = new Map<string, { stockId: string; quantity: number; feedStockNum: string }>()
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
            feedStockNum: holding.stockNum,
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
              feedStockNum: holdingData.feedStockNum,
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
            holdings: holdingsArray,
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
      where: {
        type: { equals: 'fund' },
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

    // Get active companies with their latest holdings date
    console.log('Fetching active companies with their latest holdings date...')
    const activeCompanies = await getActiveCompaniesWithLatestDate(pool)
    console.log(`Found ${activeCompanies.length} active companies to process`)

    // Control batch size and parallel processing
    const MAX_CONCURRENT_PROCESSES = 5

    // Process companies in batches with controlled concurrency
    for (let i = 0; i < activeCompanies.length; i += MAX_CONCURRENT_PROCESSES) {
      const batch = []

      // Create a batch of promises up to MAX_CONCURRENT_PROCESSES
      for (let j = 0; j < MAX_CONCURRENT_PROCESSES && i + j < activeCompanies.length; j++) {
        const company = activeCompanies[i + j]
        console.log(
          `Processing company ${company.name} (ID: ${company.firm}) with latest date ${company.latest_date1}`,
        )

        // Process all holdings for this company on its latest date
        const holdings = await getHoldingsPage(pool, company.firm, company.latest_date1)

        // Format the date for the holding day
        const formattedDate = formatDateForSQL(company.latest_date1)

        // Add to batch
        batch.push(processHoldingsChunk(holdings, formattedDate))
      }

      // Wait for all promises in the current batch to complete
      await Promise.all(batch)
      console.log(
        `Completed batch ${i / MAX_CONCURRENT_PROCESSES + 1} of ${Math.ceil(activeCompanies.length / MAX_CONCURRENT_PROCESSES)}`,
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
