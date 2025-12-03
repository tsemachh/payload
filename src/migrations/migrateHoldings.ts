import { createMSSqlPool, sqlConfig } from '@/migrations/utils/utils'
import { getStockIdToSequenceMap } from '@/migrations/utils/migrateStockUtils'
import { createErrorFaultComment, logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import sql, { IResult } from 'mssql'
import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { getHoldingsRetroDays } from '@/migrations/utils/dateUtils'
import { stringify } from 'qs-esm'

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
    const holdingsDaysRetro = getHoldingsRetroDays()
    console.log(
      `Importing holdings from the last ${holdingsDaysRetro} days for all active companies`,
    )

    // Initialize on-demand caches
    const accountCache = new Map<string, string>()
    const subAccountKeySet = new Set<string>()
    const stockCache = await getStockIdToSequenceMap(req)
    console.log('[migrateHoldings.up] stockCache size:', stockCache.size)
    let successCount = 0
    let errorCount = 0
    // Aggregate missing stockNums per company and per processed holding date
    const missingByCompanyDate = new Map<string, Map<string, Set<string>>>()

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

    // Prefetch foreign stocks (by origin === 'Foreign') to know when to attach originalForeignData
    const foreignStocks = await payload.find({
      collection: 'stocks',
      select: { name: true },
      where: { origin: { equals: 'Foreign' } },
      limit: 0,
      req,
      depth: 0,
    })
    const foreignStockIdSet = new Set<string>()
    foreignStocks.docs.forEach((s: any) => foreignStockIdSet.add(String(s.id)))

    const processHoldingsChunk = async (holdings: IResult<HoldingRow>, holdingDate: string) => {
      const companyHoldings = new Map<
        string,
        Map<
          string,
          {
            stockId: string
            quantity: number
            feedStockNum: string
            originals: { accountNum: number; quantity: number; stockId: string }[]
          }
        >
      >()
      // Collect per-company missing stock numbers (excluding silenced) to log once per holding day
      const notFoundByCompany = new Map<string, Set<string>>()

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
            severity: 'warning',
            comments: createErrorFaultComment({
              id: accountKey,
              operation: 'Holdings - Company ID lookup',
              error: new Error(`Company ID not found for account key: ${accountKey}`),
            }),
          })
          continue
        }

        // If matched via a sub-account, log informative message
        if (subAccountKeySet.has(accountKey)) {
          console.info(
            `Matched by subAccountNum: firmId=${holding.firm}, accountNum=${holding.subAccountNum}, fundId=${companyId}`,
          )
        }

        // Find the holding in the map if not found add it to the map
        let stocksMap = companyHoldings.get(companyId)
        if (!stocksMap) {
          stocksMap = new Map<
            string,
            {
              stockId: string
              quantity: number
              feedStockNum: string
              originals: { accountNum: number; quantity: number; stockId: string }[]
            }
          >()
          companyHoldings.set(companyId, stocksMap)
        }

        const stockId = stockCache.get(`${holding.stockNum}`)
        if (!stockId) {
          if (!silentStockSet.has(`${holding.stockNum}`)) {
            let set = notFoundByCompany.get(companyId)
            if (!set) {
              set = new Set<string>()
              notFoundByCompany.set(companyId, set)
            }
            set.add(String(holding.stockNum))
          }
          continue
        }

        // IMPORTANT: aggregate by resolved stockId (not by feed stockNum)
        const existingHolding = stocksMap.get(stockId)
        if (existingHolding) {
          existingHolding.quantity += holding.qty
          existingHolding.originals.push({
            stockId: String(holding.stockNum),
            accountNum: Number(holding.subAccountNum),
            quantity: holding.qty,
          })
        } else {
          stocksMap.set(stockId, {
            stockId,
            quantity: holding.qty,
            feedStockNum: holding.stockNum,
            originals: [
              {
                stockId: String(holding.stockNum),
                accountNum: Number(holding.subAccountNum),
                quantity: holding.qty,
              },
            ],
          })
        }
      }

      // Defer logging: merge missing stock numbers into global aggregator by company and date
      for (const [companyId, set] of Array.from(notFoundByCompany.entries())) {
        if (!set || set.size === 0) continue
        let byDate = missingByCompanyDate.get(companyId)
        if (!byDate) {
          byDate = new Map<string, Set<string>>()
          missingByCompanyDate.set(companyId, byDate)
        }
        let dateSet = byDate.get(holdingDate)
        if (!dateSet) {
          dateSet = new Set<string>()
          byDate.set(holdingDate, dateSet)
        }
        for (const s of set) dateSet.add(s)
      }

      // Process each company's holdings for the day
      for (const [companyId, stocksMap] of Array.from(companyHoldings.entries())) {
        try {
          // Prepare holdings array
          const rawHoldingsArray: any[] = []
          for (const [_, holdingData] of Array.from(stocksMap.entries())) {
            const isForeign = foreignStockIdSet.has(holdingData.stockId)
            const item: any = {
              stock: holdingData.stockId,
              quantity: holdingData.quantity,
              feedStockNum: holdingData.feedStockNum,
            }
            if (isForeign) {
              item.originalForeignData = holdingData.originals
            }
            rawHoldingsArray.push(item)
          }

          // Defensive consolidation by stock to avoid duplicate items with same stock
          const consolidatedByStock = new Map<string, any>()
          for (const item of rawHoldingsArray) {
            const existing = consolidatedByStock.get(item.stock)
            if (existing) {
              existing.quantity += item.quantity
              if (Array.isArray(item.originalForeignData)) {
                existing.originalForeignData = [
                  ...(existing.originalForeignData || []),
                  ...item.originalForeignData,
                ]
              }
            } else {
              consolidatedByStock.set(item.stock, { ...item })
            }
          }
          const holdingsArray = Array.from(consolidatedByStock.values())

          if (holdingsArray.length === 0) {
            console.warn(`No valid stocks found for company: ${companyId}`)
            continue
          }

          // Delete old holding day if exists
          await payload.delete({
            collection: 'holdings',
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateHoldings' },
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
              context: { ...req.context, from: 'migration', process: 'migrateHoldings' },
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
            severity: 'fatal',
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
            // Map the main account number
            const baseKey = `${parentCompanyId}-${String(account.accountNumber)}`
            accountCache.set(baseKey, company.id)
            // Map all sub-account numbers as well
            const subs = Array.isArray(account.subAccounts)
              ? account.subAccounts.map((s: any) => String(s))
              : []
            for (const sub of subs) {
              const subKey = `${parentCompanyId}-${sub}`
              accountCache.set(subKey, company.id)
              subAccountKeySet.add(subKey)
            }
          }
        })
      }
    })
    console.log(`Prefetched ${accountCache.size} accounts`)
    console.log('[migrateHoldings.up] subAccountKeySet size:', subAccountKeySet.size)

    // Get active companies with their latest holdings date
    console.log('Fetching active companies with their latest holdings date...')
    const activeCompanies = await getActiveCompaniesWithLatestDate(pool)
    console.log(`Found ${activeCompanies.length} active companies to process`)

    // Control batch size and parallel processing
    const MAX_CONCURRENT_PROCESSES = 5

    // Process companies in batches with controlled concurrency
    for (let i = 0; i < activeCompanies.length; i += MAX_CONCURRENT_PROCESSES) {
      const batch: Promise<void>[] = []

      // Create a batch of promises up to MAX_CONCURRENT_PROCESSES
      for (let j = 0; j < MAX_CONCURRENT_PROCESSES && i + j < activeCompanies.length; j++) {
        const company = activeCompanies[i + j]
        batch.push(
          (async () => {
            console.log(
              `Processing company ${company.name} (ID: ${company.firm}) with latest date ${company.latest_date1}`,
            )

            // Get all distinct holding dates for this company in the last N days (inclusive)
            const dates = await getHoldingDatesInLastNDays(
              pool,
              company.firm,
              company.latest_date1,
              holdingsDaysRetro,
            )
            console.log(
              `Found ${dates.length} holding date(s) in the last ${holdingsDaysRetro} days for company ${company.name} (ID: ${company.firm})`,
            )

            // Process each date sequentially to keep per-company load reasonable
            for (const dateStr of dates) {
              const holdings = await getHoldingsPage(pool, company.firm, String(dateStr))
              console.log(
                '[migrateHoldings.up] getHoldingsPage rows:',
                holdings.recordset?.length ?? 0,
                'for firm:',
                company.firm,
                'date:',
                String(dateStr),
              )
              const formattedDate = formatDateForSQL(String(dateStr))
              await processHoldingsChunk(holdings, formattedDate)
            }
          })(),
        )
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

// New API: Run discontinued-holdings backfill as a separate step to be called from migrateAll
export async function backfillDiscontinuedHoldings({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null
  try {
    console.log('Starting Discontinued Holdings backfill step...')
    pool = await createMSSqlPool()

    // Initialize on-demand caches (same logic as migrateHoldings.up)
    const accountCache = new Map<string, string>()
    const subAccountKeySet = new Set<string>()
    const stockCache = await getStockIdToSequenceMap(req)
    console.log('[backfillDiscontinuedHoldings] stockCache size:', stockCache.size)
    // DEBUG: show accountCache/subAccount sizes after we build them (built below)

    const silencedStocks = await payload.find({
      collection: 'silenced-stocks',
      select: { stockId: true },
      limit: 0,
      req,
    })
    const silentStockSet = new Set<string>(silencedStocks.docs.map((d: any) => String(d.stockId)))
    console.log('[backfillDiscontinuedHoldings] silenced stock IDs size:', silentStockSet.size)

    // Prefetch foreign stocks to attach originalForeignData when needed
    const foreignStocks = await payload.find({
      collection: 'stocks',
      select: { name: true },
      where: { origin: { equals: 'Foreign' } },
      limit: 0,
      req,
      depth: 0,
    })
    const foreignStockIdSet = new Set<string>(foreignStocks.docs.map((s: any) => String(s.id)))
    console.log('[backfillDiscontinuedHoldings] foreignStockIdSet size:', foreignStockIdSet.size)

    // Aggregate missing stockNums per company and per processed holding date (deferred logging)
    const missingByCompanyDate = new Map<string, Map<string, Set<string>>>()

    // Local processor copied from migrateHoldings.up
    // NOTE: Concurrency removed entirely per request — all processing is strictly sequential.

    const processHoldingsChunk = async (holdings: IResult<HoldingRow>, holdingDate: string) => {
      console.log(
        '[backfillDiscontinuedHoldings] processHoldingsChunk start:',
        'date:',
        holdingDate,
        'rows:',
        holdings.recordset?.length ?? 0,
      )
      const companyHoldings = new Map<
        string,
        Map<
          string,
          {
            stockId: string
            quantity: number
            feedStockNum: string
            originals: { accountNum: number; quantity: number; stockId: string }[]
          }
        >
      >()
      const notFoundByCompany = new Map<string, Set<string>>()
      // DEBUG: counters for visibility
      let skippedMissingCompany = 0
      let skippedMissingStock = 0
      const firstMissingCompanyKeys = new Set<string>()

      for (const holding of holdings.recordset) {
        const accountKey = `${holding.firm}-${holding.subAccountNum}`
        const companyId = accountCache.get(accountKey)
        if (!companyId) {
          skippedMissingCompany++
          if (firstMissingCompanyKeys.size < 10) firstMissingCompanyKeys.add(accountKey)
          await logMigrationFault({
            payload,
            type: 'holding',
            row: JSON.stringify(holding),
            typeId: accountKey,
            severity: 'warning',
            comments: createErrorFaultComment({
              id: accountKey,
              operation: 'Holdings - Company ID lookup',
              error: new Error(`Company ID not found for account key: ${accountKey}`),
            }),
          })
          continue
        }

        if (subAccountKeySet.has(accountKey)) {
          console.info(
            `Matched by subAccountNum: firmId=${holding.firm}, accountNum=${holding.subAccountNum}, fundId=${companyId}`,
          )
        }

        let stocksMap = companyHoldings.get(companyId)
        if (!stocksMap) {
          stocksMap = new Map<
            string,
            {
              stockId: string
              quantity: number
              feedStockNum: string
              originals: { accountNum: number; quantity: number; stockId: string }[]
            }
          >()
          companyHoldings.set(companyId, stocksMap)
        }

        const stockId = stockCache.get(`${holding.stockNum}`)
        if (!stockId) {
          //console.log('missing stockId:' + holding.stockNum)
          skippedMissingStock++
          if (!silentStockSet.has(`${holding.stockNum}`)) {
            let set = notFoundByCompany.get(companyId)
            if (!set) {
              set = new Set<string>()
              notFoundByCompany.set(companyId, set)
            }
            set.add(String(holding.stockNum))
          }
          continue
        }

        const existingHolding = stocksMap.get(stockId)
        if (existingHolding) {
          existingHolding.quantity += holding.qty
          existingHolding.originals.push({
            stockId: String(holding.stockNum),
            accountNum: Number(holding.subAccountNum),
            quantity: holding.qty,
          })
        } else {
          stocksMap.set(stockId, {
            stockId,
            quantity: holding.qty,
            feedStockNum: holding.stockNum,
            originals: [
              {
                stockId: String(holding.stockNum),
                accountNum: Number(holding.subAccountNum),
                quantity: holding.qty,
              },
            ],
          })
        }
      }

      // DEBUG summary for the chunk
      if (skippedMissingCompany > 0 || skippedMissingStock > 0) {
        console.warn(
          '[backfillDiscontinuedHoldings] chunk skips summary:',
          'date:',
          holdingDate,
          '| missingCompany:',
          skippedMissingCompany,
          '| missingStock:',
          skippedMissingStock,
        )
        if (firstMissingCompanyKeys.size > 0) {
          console.warn(
            '[backfillDiscontinuedHoldings] first missing account keys (up to 10):',
            Array.from(firstMissingCompanyKeys).join(', '),
          )
        }
      }

      // Defer logging: merge missing stock numbers into global aggregator by company and date
      for (const [companyId, set] of Array.from(notFoundByCompany.entries())) {
        if (!set || set.size === 0) continue
        let byDate = missingByCompanyDate.get(companyId)
        if (!byDate) {
          byDate = new Map<string, Set<string>>()
          missingByCompanyDate.set(companyId, byDate)
        }
        let dateSet = byDate.get(holdingDate)
        if (!dateSet) {
          dateSet = new Set<string>()
          byDate.set(holdingDate, dateSet)
        }
        for (const s of set) dateSet.add(s)
      }

      for (const [companyId, stocksMap] of Array.from(companyHoldings.entries())) {
        try {
          const rawHoldingsArray: any[] = []
          for (const [, holdingData] of Array.from(stocksMap.entries())) {
            const isForeign = foreignStockIdSet.has(holdingData.stockId)
            const item: any = {
              stock: holdingData.stockId,
              quantity: holdingData.quantity,
              feedStockNum: holdingData.feedStockNum,
            }
            if (isForeign) item.originalForeignData = holdingData.originals
            rawHoldingsArray.push(item)
          }

          const consolidatedByStock = new Map<string, any>()
          for (const item of rawHoldingsArray) {
            const existing = consolidatedByStock.get(item.stock)
            if (existing) {
              existing.quantity += item.quantity
              if (Array.isArray(item.originalForeignData)) {
                existing.originalForeignData = [
                  ...(existing.originalForeignData || []),
                  ...item.originalForeignData,
                ]
              }
            } else {
              consolidatedByStock.set(item.stock, { ...item })
            }
          }
          const holdingsArray = Array.from(consolidatedByStock.values())
          if (holdingsArray.length === 0) {
            console.warn(
              `[backfillDiscontinuedHoldings] No valid stocks found for company: ${companyId} (date ${holdingDate})`,
            )
            continue
          }
          // Create new holding day with all stocks
          const holdingDayData = {
            fund: companyId,
            valueDate: holdingDate,
            holdings: holdingsArray,
          }
          console.log(
            '[backfillDiscontinuedHoldings] creating holdings for:',
            companyId,
            'date:',
            holdingDate,
            'items:',
            holdingsArray.length,
          )

          await payload.create({
            collection: 'holdings',
            data: holdingDayData,
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateHoldings' },
            },
          })
          console.log('[backfillDiscontinuedHoldings] created holdings for:', companyId)

          const delayMs = Number(process.env.DISCONTINUED_UPSERT_DELAY_MS || '0')
          if (delayMs > 0)
            console.log('[backfillDiscontinuedHoldings] delay after upsert(ms):', delayMs)
          if (delayMs > 0) await new Promise((r) => setTimeout(r, Math.min(delayMs, 200)))
        } catch (error) {
          console.error(`Error processing holdings for company ${companyId}:`, error)
          await logMigrationFault({
            payload,
            type: 'holding',
            row: '',
            typeId: '',
            severity: 'fatal',
            comments: createErrorFaultComment({
              id: companyId,
              operation: 'Holdings',
              error: error as Error,
            }),
          })
        }
      }
    }

    // Build account cache like in migrateHoldings.up (mirroring logic)
    console.log('Prefetching companies with account information (backfill)...')
    const allCompanies = await payload.find({
      collection: 'companies',
      limit: 0,
      where: { type: { equals: 'fund' } },
      req,
      depth: 0,
    })
    allCompanies.docs.forEach((company: any) => {
      const parentCompanyId: string | null = (company.legacyCompanyId as string) || null
      if (company.mainAccount && Array.isArray(company.mainAccount)) {
        company.mainAccount.forEach((account: any) => {
          if (parentCompanyId) {
            const baseKey = `${parentCompanyId}-${String(account.accountNumber)}`
            accountCache.set(baseKey, company.id)
            const subs = Array.isArray(account.subAccounts)
              ? account.subAccounts.map((s: any) => String(s))
              : []
            for (const sub of subs) {
              const subKey = `${parentCompanyId}-${sub}`
              accountCache.set(subKey, company.id)
              subAccountKeySet.add(subKey)
            }
          }
        })
      }
    })
    console.log('[backfillDiscontinuedHoldings] accountCache size:', accountCache.size)
    console.log('[backfillDiscontinuedHoldings] subAccountKeySet size:', subAccountKeySet.size)

    console.log('Fetching latest firm/date pairs for discontinued stocks (last 5 years)...')
    const discontinuedHoldingsQuery = `
      WITH RankedStocks AS (
          SELECT  stockID,
                  [name],
                  [symbol],
                  [type],
                  [closingRate],
                  [marketValue],
                  [registeredValue],
                  [valueDate],
                  [logUpdateID],
                  [longName],
                  ROW_NUMBER() OVER (
                      PARTITION BY stockID
                      ORDER BY valueDate DESC, logUpdateID DESC
                  ) AS rn
          FROM [${sqlConfig.database}].[dbo].[stocks]
          WHERE valueDate >= DATEADD(YEAR, -5, GETDATE())
      ),
      StockNumList AS (
          SELECT DISTINCT stockID AS stockNum
          FROM RankedStocks
          WHERE rn = 1
      ),
      HoldingStockList AS (
          SELECT stockNum FROM StockNumList
          UNION
          SELECT c.Id2 AS stockNum
          FROM [${sqlConfig.database}].[dbo].[tblSecurityIdConnections] c
          JOIN StockNumList s ON c.Id1 = s.stockNum
      ),
      LastHoldingDates AS (
          SELECT 
              h.stockNum,
              h.firm,
              MAX(h.date1) AS LastHeldDate
          FROM [${sqlConfig.database}].[dbo].[holdings] h
          JOIN HoldingStockList hsl ON h.stockNum = hsl.stockNum
          WHERE h.date1 >= DATEADD(YEAR, -5, GETDATE())
          GROUP BY h.stockNum, h.firm
      )
      SELECT 
          h.firm,
          CONVERT(VARCHAR(10), h.date1, 110) AS date1,
          SUM(h.qty) AS TotalQty,
          COUNT(DISTINCT h.subAccountNum) AS SubAccountCount
      FROM [${sqlConfig.database}].[dbo].[holdings] h
      JOIN LastHoldingDates lhd 
            ON  h.stockNum = lhd.stockNum
            AND h.firm    = lhd.firm
            AND h.date1   = lhd.LastHeldDate
      WHERE h.date1 >= DATEADD(YEAR, -5, GETDATE())
      GROUP BY h.firm, h.date1
      ORDER BY h.firm, h.date1;`

    const discontinuedPairs = await pool.request().query(discontinuedHoldingsQuery)
    console.log(`Found ${discontinuedPairs.recordset.length} (firm, date1) pairs to backfill.`)

    // Process strictly sequentially — no batching, no parallelism
    let processed = 0
    for (const row of discontinuedPairs.recordset as Array<{ firm: string; date1: string }>) {
      try {
        const firm = String(row.firm)
        const dateStr = formatDateForSQL(String(row.date1))
        const holdings = await getHoldingsPage(pool as sql.ConnectionPool, firm, dateStr)
        console.log(
          '[backfillDiscontinuedHoldings] fetched holdings rows:',
          holdings.recordset?.length ?? 0,
          'for firm:',
          firm,
          'date:',
          dateStr,
        )
        await processHoldingsChunk(holdings, dateStr)
      } catch (e) {
        console.error('Error processing discontinued holding pair', row, e)
      }
      processed++
      if (processed % 50 === 0 || processed === discontinuedPairs.recordset.length) {
        console.log(`Progress: ${processed}/${discontinuedPairs.recordset.length} pairs processed`)
      }
      // Yield to event loop to avoid starving I/O
      await new Promise((r) => setImmediate(r))
    }

    console.log('Discontinued holdings backfill completed')
    // Emit consolidated warnings after all dates have been processed
    for (const [companyId, datesMap] of Array.from(missingByCompanyDate.entries())) {
      for (const [dateStr, set] of Array.from(datesMap.entries())) {
        if (set && set.size > 0) {
          const list = Array.from(set).join(',')
          console.warn(`Stock IDs not found for company ${companyId} on ${dateStr}: ${list}`)
        }
      }
    }
  } catch (e) {
    console.error('Discontinued holdings backfill failed', e)
    throw e
  } finally {
    if (pool) await pool.close()
  }
}

// Returns all distinct holding dates for the given firm in the last N days (inclusive),
// relative to the provided latestDate. Dates are returned as strings in MM-DD-YYYY format.
async function getHoldingDatesInLastNDays(
  pool: sql.ConnectionPool,
  firm: string,
  latestDate: string,
  days: number,
): Promise<string[]> {
  const formattedLatest = formatDateForSQL(latestDate)
  const result = await pool.request().query(`
      SELECT DISTINCT CONVERT(VARCHAR(10), [date1], 110) AS [date1]
      FROM [${sqlConfig.database}].[dbo].[holdings]
      WHERE [firm] = '${firm}'
        AND [date1] BETWEEN DATEADD(day, -${days}, '${formattedLatest}') AND '${formattedLatest}'
      ORDER BY [date1]
  `)
  return result.recordset.map((row: any) => row.date1 as string)
}
