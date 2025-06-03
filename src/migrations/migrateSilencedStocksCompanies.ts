import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { createErrorFaultComment, logMigrationFault } from '@/utils/migrationFaultUtils'
import { getCompanyIdToChildCompanies, getCompanyIdToSequenceMap } from '@/utils/utils'

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
  requestTimeout: 120000, // 2 minutes timeout
}

// Minimum date for holdings (January 1, 2024)
const MIN_HOLDINGS_DATE = '2024-01-01'

interface StockFirmRow {
  stockNum: string
  firm: string
}

async function getDistinctStockFirms(pool: sql.ConnectionPool): Promise<sql.IResult<StockFirmRow>> {
  return await pool.request().query(`
    SELECT distinct [stockNum]
      ,[firm]
    FROM [dbEmda].[dbo].[holdings]
    WHERE [date1] >= '${MIN_HOLDINGS_DATE}'
  `)
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting silenced stocks companies migration process...')
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Initialize counters
    let successCount = 0
    let errorCount = 0

    // Preload company mappings
    console.log('Preloading company mappings...')
    const companyIdToSequence = await getCompanyIdToSequenceMap(payload)
    const companyIdToChildCompanies = await getCompanyIdToChildCompanies(payload)
    console.log(`Preloaded ${companyIdToSequence.size} companies`)
    console.log(`Preloaded ${companyIdToChildCompanies.size} companies with child companies`)

    // Get distinct stockNum and firm from holdings table
    console.log('Fetching distinct stock numbers and firms from holdings...')
    const stockFirmsResult = await getDistinctStockFirms(pool)
    console.log(`Found ${stockFirmsResult.recordset.length} distinct stock-firm pairs from ${MIN_HOLDINGS_DATE}`)

    // Create a map of company ID to silenced stocks
    const companyToStocks = new Map<string, Set<string>>()

    // Create a map of stockNum to firms from holdings
    const stockToFirms = new Map<string, Set<string>>()
    for (const row of stockFirmsResult.recordset) {
      if (!stockToFirms.has(`${row.stockNum}`)) {
        stockToFirms.set(`${row.stockNum}`, new Set<string>())
      }
      stockToFirms.get(`${row.stockNum}`)?.add(`${row.firm}`)
    }

    // Read all entries from SilencedStocks collection
    console.log('Fetching all silenced stocks...')
    const silencedStocks = await payload.find({
      collection: 'silenced-stocks',
      limit: 0,
      req,
    })
    console.log(`Found ${silencedStocks.docs.length} silenced stocks`)

    // For each silenced stock, find the firm IDs pointing to it and add to company-to-stocks map
    for (const silencedStock of silencedStocks.docs) {
      const stockId = silencedStock.stockId
      if (!stockId) {
        console.warn(`Silenced stock with ID ${silencedStock.id} has no stockId, skipping`)
        continue
      }

      // Get firms for this stock
      const firms = stockToFirms.get(stockId)
      if (!firms || firms.size === 0) {
        console.log(`No firms found for silenced stock ${stockId}, skipping`)
        continue
      }

      // Convert firms to company IDs and add stock to each company
      for (const firm of firms) {
        const companyId = companyIdToSequence.get(firm)
        if (companyId) {
          // Add stock to company
          if (!companyToStocks.has(companyId)) {
            companyToStocks.set(companyId, new Set<string>())
          }
          companyToStocks.get(companyId)?.add(stockId)

/*          // Also add to child companies
          const companyChildIds = companyIdToChildCompanies.get(firm)
          if (companyChildIds && companyChildIds.length > 0) {
            for (const childId of companyChildIds) {
              if (!companyToStocks.has(childId)) {
                companyToStocks.set(childId, new Set<string>())
              }
              companyToStocks.get(childId)?.add(stockId)
            }
          }*/
        } else {
          console.warn(`Company ID not found for firm: ${firm}`)
        }
      }
    }

    // Update each company with its silenced stocks
    const companyIds = Array.from(companyToStocks.keys())
    console.log(`Updating ${companyIds.length} companies with silenced stocks...`)

    for (const companyId of companyIds) {
      try {
        const silencedStockIds = Array.from(companyToStocks.get(companyId) || [])

        if (silencedStockIds.length === 0) {
          console.log(`No silenced stocks for company ${companyId}, skipping`)
          continue
        }

        // Update the company with its silenced stocks
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            silencedStocks: silencedStockIds,
          },
          req,
        })

        successCount++
        console.log(
          `✓ Updated company ${companyId} with ${silencedStockIds.length} silenced stocks (${successCount}/${companyIds.length})`,
        )
      } catch (error) {
        errorCount++
        console.error(`Error updating company ${companyId}:`, error)
        await logMigrationFault({
          payload,
          type: 'company',
          row: JSON.stringify({ companyId }),
          typeId: companyId,
          comments: createErrorFaultComment({
            id: companyId,
            operation: 'Update company silenced stocks',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total companies processed: ${companyIds.length}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Critical error during migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  } finally {
    console.log('Closing SQL Server connection...')
    if (pool) {
      await pool.close() // Close the connection pool
    }
    console.log('SQL Server connection closed')
  }
}
