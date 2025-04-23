import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock, StockOrigin } from '@/payload-types'
import { getStockType } from '@/utils/migrateStockUtils'
import { getCollectionDoc, getStockByStockId } from '@/utils/utils'
import {
  getAllStocksInLatestMeetings,
  getAllStocksInMeetings,
  getEmdaStockIds,
  getPredictaStockIds,
  getStockIdsByMappingType,
  getStockRelations,
  getStocks,
  getStockValues,
  upsertStockFromImport,
  upsertStockValueFromImport,
} from '@/utils/migrateUtils'
import {
  createErrorFaultComment,
  createStockFaultComment,
  createStockRelationFaultComment,
  createStockValueFaultComment,
  logMigrationFault,
} from '@/utils/migrationFaultUtils'
import { seedStockMigrationMapping } from '@/utils/seedStockMigrationMapping'
import { PayloadRequest } from 'payload'

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

async function insertSilenceStocks(stockId:string,req:PayloadRequest) {
  try {
    // Check if a silenced stock with this stockId already exists
    const existingSilencedStock = await req.payload.find({
      collection: 'silenced-stocks',
      limit: 1,
      where: {
        stockId: { equals: stockId },
      },
    })

    // Only create if it doesn't exist
    if (existingSilencedStock.docs.length === 0) {
      await req.payload.create({
        collection: 'silenced-stocks',
        data: { stockId },
        req,
      })
    }
  }catch(e){
    console.error(`Error in silence stock ${stockId}`,e)
  }
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    await seedStockMigrationMapping()
    const resultStocks = await getStocks(pool) //AllStocks
    const predictaStocks: Set<string> = await getPredictaStockIds(pool) //Bursa stocks
    //const predictaHistoryStocks: Set<string> = await getHistoryPredictaStockIds(pool) //Bursa stocks including history
    const emdaStocks: Set<string> = await getEmdaStockIds(pool) //Shaked feed stocks
    const relationStocks: Map<string, string> = await getStockRelations(pool, payload) // stock relations
    const rootRelatedStocks: Set<string> = new Set<string>(relationStocks.values()) // All stock which someone points to
    const stocksInMeeting: Set<string> = await getAllStocksInMeetings(pool)
    const stocksInLatestMeeting: Set<string> = await getAllStocksInLatestMeetings(pool)
    const resultStockValues = await getStockValues(pool) //TODO need to take only 7 years back of stocks
    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    const stockIdTOSequence: Map<string, string> = new Map<string, string>()

    // Get stock status from migration mapping
    console.log('Fetching stock statuses from migration mapping...')
    const [notActiveStocks, nonTradableStocks, privateStocks, foreignStocks] = await Promise.all([
      getStockIdsByMappingType(payload, 'NotActive'),
      getStockIdsByMappingType(payload, 'NonTradable'),
      getStockIdsByMappingType(payload, 'Private'),
      getStockIdsByMappingType(payload, 'Foreign'),
    ])

    for (const row of resultStocks.recordset) {
      row.stockID = `${row.stockID}`
      // Check stock status from migration mapping
      const relatedStock = relationStocks.get(row.stockID)
      const isRootStock = rootRelatedStocks.has(row.stockID)
      // Consolidate all stock statuses in one place
      const stockStatuses = {
        // Basic statuses from mapping
        isNotActive: notActiveStocks.has(row.stockID),
        isNonTradable: nonTradableStocks.has(row.stockID),
        isPrivate: privateStocks.has(row.stockID),

        // Stock source statuses
        isPredictaStock: predictaStocks.has(row.stockID),
        isEmdaStock: emdaStocks.has(row.stockID),

        // Meeting status
        hasActiveMeeting: stocksInMeeting.has(row.stockID),
        hasLatestMeeting: stocksInLatestMeeting.has(row.stockID),
        // Relationship statuses
        hasTradableRelation: !!(relatedStock && predictaStocks.has(relatedStock)),
        hasForeignRelation: !!(relatedStock && foreignStocks.has(relatedStock)),
        // Root statuses
        isRootStock: isRootStock,
        isRootEmda: isRootStock && emdaStocks.has(row.stockID),

        // Foreign status (including relations)
        isForeign: foreignStocks.has(row.stockID) 
      }

      // Determine if stock should be processed
      const shouldProcessStock =
        stockStatuses.isPredictaStock ||
        stockStatuses.isEmdaStock ||
        stockStatuses.hasActiveMeeting ||
        stockStatuses.isForeign ||
        stockStatuses.isPrivate ||
        stockStatuses.isNonTradable ||
        stockStatuses.isNotActive

      if (shouldProcessStock) {
        try {
          let stockSequence: string | null | undefined = stockIdTOSequence.get(row.stockID)
          let stock:Stock | null;
          if (!stockSequence) {
            stock = await getStockByStockId(payload, row.stockID)
          }else{
            stock = await getCollectionDoc(req,"stocks",stockSequence)
          }
          row.type = getStockType(row.type)

          // Determine origin with clear priority
          let origin: StockOrigin = 'TASE'
          if (stockStatuses.isPrivate) origin = 'Private'
          else if (stockStatuses.isNonTradable) origin = 'Deleted'
          else if (stockStatuses.isForeign) origin = 'Foreign'

          // Determine tradable status:
          // - Predicta stocks are tradable
          // - Root EMDA stocks are tradable
          // - Foreign stocks are tradable unless they are non-tradable or private
          const isTradable =
            stockStatuses.isPredictaStock ||
            stockStatuses.isPrivate ||
            stockStatuses.isRootStock ||
            stockStatuses.isNonTradable ||
            stockStatuses.isForeign

          let comments= JSON.stringify(stockStatuses)
          // Determine active status:
          // - Not active stocks are never active
          // - Stocks with meetings are not active unless they are Predicta or EMDA stocks
          let isActive = !(stockStatuses.isNotActive || (stockStatuses.hasActiveMeeting && !stockStatuses.isPredictaStock && !stockStatuses.isEmdaStock))
          if (!isTradable && !relatedStock){
            if (!stockStatuses.hasActiveMeeting){
              //Move stock to Silenced stocks
              await insertSilenceStocks(row.stockID,req)
              successCount++
              continue
            }else{
              //Check if no meeting since January 1st, 2024 and set as inactive
              if (stock && !stockStatuses.hasLatestMeeting){
                isActive = false
              }else{
                if (stock){                 //Others, that has meetings in 2024, put in a collections stocks for review and ask Shaked to check
                  isActive = true
                  comments += 'Shaked , please review'
                }
              }
            }
          }
          stockSequence = await upsertStockFromImport(
            stock,
            row,
            req,
            isTradable,
            origin,
            isActive,
            comments
          )
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
            isPredictaStock: stockStatuses.isPredictaStock,
            isEmdaStock: stockStatuses.isEmdaStock,
            hasTradableRelationStock: stockStatuses.hasTradableRelation,
            stockHasMeeting: stockStatuses.hasActiveMeeting,
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
              relatedStock: relatedStock as Stock['id'],
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
        const isRootForeignStock = rootRelatedStocks.has(row.stockID) && !isPredictaStock
        const isEmdaStock= emdaStocks.has(row.stockID)
        if (!stockSequence || (!isPredictaStock && !isEmdaStock && !isRootForeignStock)) {
          await logMigrationFault({
            payload,
            type: 'stock-value',
            typeId: row.stockID,
            comments: `Stock value not migrated - isPredictaStock: ${isPredictaStock}, isRootForeignStock: ${isRootForeignStock} isEmdaStock: ${isEmdaStock}`,
            row,
          })
          continue
        }
        await upsertStockValueFromImport(stockSequence, row, req)

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
