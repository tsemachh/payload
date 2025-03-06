import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock, StockType } from '@/payload-types'
import { getStockType, StockRow } from '@/utils/migrationUtils'
import { getSeqeunceStockId } from '../utils/utils'
import {
  getAllStocksInMeetings,
  getEmdaStockIds,
  getPredictaStockIds,
  getStockRelations,
  getStocks,
  getStockValues, upsertStockFromImport, upsertStockValueFromImport,
} from '@/utils/migrateUtils'
import {
  logMigrationFault,
  createStockFaultComment,
  createStockRelationFaultComment, createErrorFaultComment, createStockValueFaultComment,
} from '@/utils/migrationFaultUtils'

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'master', // Change this to your database name once created
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true, // For local dev
  },
  requestTimeout: 120000, // Increase timeout globally to 120 seconds
}
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    const resultStocks = await getStocks(pool)
    const predictaStocks: Set<string> = await getPredictaStockIds(pool)
    const emdaStocks: Set<string> = await getEmdaStockIds(pool)
    const relationStocks: Map<string, string> = await getStockRelations(pool, payload)
    const rootRelatedStocks:Set<string> = new Set<string>(relationStocks.values())
    const stocksInMeeting: Set<string> = await getAllStocksInMeetings(pool)
    const resultStockValues = await getStockValues(pool)
    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    const stockIdTOSequence: Map<string, string> = new Map<string, string>()
    for (const row of resultStocks.recordset) {
      row.stockID = `${row.stockID}`
      const relatedStock = relationStocks.get(row.stockID)
      const hasTradableRelationStock:boolean = !!(relatedStock && predictaStocks.has(relatedStock))
      const hasForeignRelationStock = relatedStock && !predictaStocks.has(relatedStock)
      const isPredictaStock = predictaStocks.has(row.stockID)
      const isEmdaStock = emdaStocks.has(row.stockID)
      const stockHasMeeting = stocksInMeeting.has(row.stockID)
      const isRootEmdaStock=rootRelatedStocks.has(row.stockID) && isEmdaStock
      const isRootForeignStock=rootRelatedStocks.has(row.stockID) && !isPredictaStock
      if (
        isPredictaStock ||
        (isEmdaStock && (hasTradableRelationStock || isRootEmdaStock)) ||
        (hasForeignRelationStock) || (isRootForeignStock) ||
        stockHasMeeting
      ) {
        try {
          let stockSequence: string | null | undefined = stockIdTOSequence.get(row.stockID)
          if (!stockSequence) stockSequence = await getSeqeunceStockId(payload, row.stockID)
          row.type = getStockType(row)

          stockSequence=await upsertStockFromImport(stockSequence,row,req,isPredictaStock || isRootForeignStock,hasForeignRelationStock || isRootForeignStock )
          stockIdTOSequence.set(row.stockID, stockSequence)

          successCount++
          /*            console.log(
              `✓ Inserted stock : ${row.stockID} (${successCount}/${resultStocks.recordset.length})`,
            )*/
        } catch (error) {
          errorCount++
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: row.stockID,
            comments: createErrorFaultComment({
              operation: 'insert stock',
              id: row.stockID,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
            row,
          })
          throw error
        }
      } else {
        await logMigrationFault({
          payload,
          type: 'stock',
          typeId: row.stockID,
          comments: createStockFaultComment({
            isPredictaStock,
            isEmdaStock,
            hasTradableRelationStock,
            stockHasMeeting,
          }),
          row,
        })
      }
    }
    successCount = 0
    errorCount = 0
    const relationStocksLength = relationStocks.size
    for (const [id1, id2] of relationStocks.entries()) {
      try {
        const relatedStock = stockIdTOSequence.get(id2)
        const theStockToUpdate = stockIdTOSequence.get(id1)

        if (theStockToUpdate && relatedStock) {
          await payload.update({
            collection: 'stocks',
            id: theStockToUpdate,
            data: {
              relatedStock: relatedStock as Stock['id']
            },
            req,
          })
          successCount++
          console.log(`✓ Inserted stock relation: ${id1} (${successCount}/${relationStocksLength})`)
        } else {
          await logMigrationFault({
            payload,
            type: 'stock-relation',
            typeId: `${id1}->${id2}`,
            comments: createStockRelationFaultComment({
              stockId1: `${id1}-${theStockToUpdate}`,
              stockId2: `${id2}-${relatedStock}`,
            }),
          })
          errorCount++
          console.log(
            `✗ Failed to insert stock relation ${id1} (${successCount}/${relationStocksLength})`,
          )
        }
      } catch (error) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'stock-relation',
          typeId: `${id1}->${id2}`,
          comments: createErrorFaultComment({
            operation: 'insert stock relation',
            id: `${id1}->${id2}`,
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
        throw error
      }
    }
    successCount = 0
    errorCount = 0

    for (const row of resultStockValues.recordset) {
      try {
        row.stockID = `${row.stockID}`
        const stockSequence = stockIdTOSequence.get(row.stockID)
        const isPredictaStock = predictaStocks.has(row.stockID)
        const isRootForeignStock=rootRelatedStocks.has(row.stockID) && !isPredictaStock

        if (!stockSequence || (!isPredictaStock && !isRootForeignStock)) {
          await logMigrationFault({
            payload,
            type: 'stock-value',
            typeId: row.stockID,
            comments: `Stock value not migrated - isPredictaStock: ${isPredictaStock}, isRootForeignStock: ${isRootForeignStock}`,
            row,
          })
          continue
        }
        await upsertStockValueFromImport( stockSequence, row, req)

        successCount++
        console.log(
          `✓ Inserted stock value: ${row.symbol} (${successCount}/${resultStockValues.recordset.length})`,
        )
      } catch (error) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'stock-value',
          typeId: row.symbol,
          comments: createStockValueFaultComment({
            stockId: row.symbol,
            error: error instanceof Error ? error : new Error(String(error)),
          }),
          row,
        })
        throw error
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total records processed: ${resultStockValues.recordset.length}`)
    console.log(`Successfully inserted: ${successCount}`)
    console.log(`Failed insertions: ${errorCount}`)
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

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
