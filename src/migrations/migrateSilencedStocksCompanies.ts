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

interface StockFirmRow {
  stockNum: string
  firm: string
}

async function getDistinctStockFirms(pool: sql.ConnectionPool): Promise<sql.IResult<StockFirmRow>> {
  return await pool.request().query(`
    SELECT distinct [stockNum]
      ,[firm]
    FROM [dbEmda].[dbo].[holdings]
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

    // Preload companyIdToSequence mapping
    console.log('Preloading company ID to sequence mapping...')
    const companyIdToSequence = await getCompanyIdToSequenceMap(payload)
    const companyIdToChildCompanies = await getCompanyIdToChildCompanies(payload)
    console.log(`Preloaded ${companyIdToSequence.size} companies`)
    console.log(`Preloaded ${companyIdToChildCompanies.size} companies`)

    // Get distinct stockNum and firm from holdings table
    console.log('Fetching distinct stock numbers and firms from holdings...')
    const stockFirmsResult = await getDistinctStockFirms(pool)
    console.log(`Found ${stockFirmsResult.recordset.length} distinct stock-firm pairs`)

    // Create a map of stockNum to firms
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

    // For each silenced stock, find the firm IDs pointing to it and update the record
    for (const silencedStock of silencedStocks.docs) {
      try {
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

        // Convert firms to company IDs
        let companyIds: string[] = []
        for (const firm of firms) {
          const companyId = companyIdToSequence.get(firm)
          if (companyId) {
            companyIds.push(companyId)
          } else {
            console.warn(`Company ID not found for firm: ${firm}`)
          }
          const companyChildIds = companyIdToChildCompanies.get(firm)
          if (companyChildIds && companyChildIds.length >0) {
            companyIds=companyIds.concat(companyChildIds)
          }
        }

        if (companyIds.length === 0) {
          console.warn(`No valid company IDs found for silenced stock ${stockId}, skipping`)
          continue
        }

        // Update the silenced stock with the company IDs
        await payload.update({
          collection: 'silenced-stocks',
          id: silencedStock.id,
          data: {
            companies: companyIds,
          },
          req,
        })

        successCount++
        console.log(
          `✓ Updated silenced stock ${stockId} with ${companyIds.length} companies (${successCount}/${silencedStocks.docs.length})`,
        )
      } catch (error) {
        errorCount++
        console.error(`Error updating silenced stock ${silencedStock.stockId}:`, error)
        await logMigrationFault({
          payload,
          type: 'silenced-stock',
          row: JSON.stringify(silencedStock),
          typeId: silencedStock.stockId || '',
          comments: createErrorFaultComment({
            id: silencedStock.id,
            operation: 'Update silenced stock companies',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total silenced stocks processed: ${silencedStocks.docs.length}`)
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
