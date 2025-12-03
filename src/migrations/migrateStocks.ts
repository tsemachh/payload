import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock, StockOrigin } from '@/payload-types'
import { getStockType } from '@/migrations/utils/migrateStockUtils'
import { getCollectionDoc, getStockByStockId, getStockIdToSequenceMap } from '@/utils/utils'
import {
  getAllStocksInLatestMeetings,
  getAllStocksInMeetings,
  getEmdaStockIds,
  getFinancialSecurityIds,
  getPredictaStockIds,
  getStockIdsByMappingType,
  getStockRelations,
  getStocks,
  getStockValues,
  upsertStockFromImport,
  upsertStockValueFromImport,
} from '@/migrations/utils/migrateUtils'
import {
  createErrorFaultComment,
  createStockFaultComment,
  createStockRelationFaultComment,
  createStockValueFaultComment,
  logMigrationFault,
} from '@/migrations/utils/migrationFaultUtils'
import { seedStockMigrationMapping } from '@/utils/seedStockMigrationMapping'
import { PayloadRequest } from 'payload'
import { PromisePool } from '@/utils/promisePool'
import { createMSSqlPool } from '@/migrations/utils/utils'

async function insertSilenceStocks(stockId: string, req: PayloadRequest) {
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
        req: {
          ...req,
          context: { ...req.context, from: 'migration', process: 'migrateStocks' },
        },
      })
    }
  } catch (e) {
    console.error(`Error in silence stock ${stockId}`, e)
  }
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration process...')
    pool = await createMSSqlPool()
    await seedStockMigrationMapping()
    const resultStocks = await getStocks(pool) //AllStocks
    const predictaStocks: Set<string> = await getPredictaStockIds(pool) //Bursa stocks
    //const predictaHistoryStocks: Set<string> = await getHistoryPredictaStockIds(pool) //Bursa stocks including history
    const emdaStocks: Set<string> = await getEmdaStockIds(pool) //Shaked feed stocks
    const financialSecurityIds: Set<string> = await getFinancialSecurityIds(pool) // Financial securities from FinancialGroupChosen table
    const relationStocks: Map<string, string> = await getStockRelations(pool, payload) // stock relations
    const rootRelatedStocks: Set<string> = new Set<string>(relationStocks.values()) // All stock which someone points to
    const stocksInMeeting: Set<string> = await getAllStocksInMeetings(pool)
    const stocksInLatestMeeting: Set<string> = await getAllStocksInLatestMeetings(pool)
    const resultStockValues = await getStockValues(pool) //TODO need to take only 7 years back of stocks
    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    const stockIdTOSequence: Map<string, string> = await getStockIdToSequenceMap(payload)

    // Get stock status from migration mapping
    console.log('Fetching stock statuses from migration mapping...')
    const [
      notActiveStocksShaked,
      nonTradableStocksShaked,
      privateStocksShaked,
      foreignStocksShaked,
    ] = await Promise.all([
      getStockIdsByMappingType(payload, 'NotActive'),
      getStockIdsByMappingType(payload, 'NonTradable'),
      getStockIdsByMappingType(payload, 'Private'),
      getStockIdsByMappingType(payload, 'Foreign'),
    ])

    // Create a map of stockId -> stock record
    const stockIdToStockRecord = new Map<string, any>()

    // Group stocks by stockID
    resultStocks.recordset.forEach((row) => {
      row.stockID = `${row.stockID}`
      // Since each stockID should only appear once in the stocks table,
      // we're just storing the row directly rather than creating an array
      if (!stockIdToStockRecord.get(row.stockID)) stockIdToStockRecord.set(row.stockID, row)
    })

    console.log(`Grouped stocks into ${stockIdToStockRecord.size} unique stockIDs`)

    // Create a promise pool with concurrency of 20 for processing different stockIDs concurrently
    const stocksPool = new PromisePool(20)

    // Process each stockID sequentially, but process different stockIDs concurrently
    Array.from(stockIdToStockRecord.entries()).map(([stockID, row]) => {
      return stocksPool.add(async () => {
        // Check stock status from migration mapping
        const relatedStock = relationStocks.get(stockID)
        const isRootStock = rootRelatedStocks.has(stockID)

        // Consolidate all stock statuses in one place
        const stockStatuses = {
          // Basic statuses from mapping
          isNotActiveShaked: notActiveStocksShaked.has(stockID),
          isNonTradableShaked: nonTradableStocksShaked.has(stockID),
          isPrivateShaked: privateStocksShaked.has(stockID),

          // Stock source statuses
          isPredictaStock: predictaStocks.has(stockID),
          isEmdaStock: emdaStocks.has(stockID),

          // Financial status
          isFinancial: financialSecurityIds.has(stockID),

          // Meeting status
          hasActiveMeeting:
            stocksInMeeting.has(stockID) || (relatedStock && stocksInMeeting.has(relatedStock)),
          hasLatestMeeting:
            stocksInLatestMeeting.has(stockID) ||
            (relatedStock && stocksInLatestMeeting.has(relatedStock)),

          // Relationship statuses
          hasTradableRelation: !!(relatedStock && predictaStocks.has(relatedStock)),
          hasForeignRelation: !!(relatedStock && foreignStocksShaked.has(relatedStock)),
          hasRelation: !!relatedStock,

          // Root statuses
          isRootStock: isRootStock,
          isRootEmda: isRootStock && emdaStocks.has(stockID),

          // Foreign status (including relations)
          isForeign: foreignStocksShaked.has(stockID),

          //shouldProcessStock
          isTradable: false,
          shouldProcessStock: false,
        }

        // Determine if stock should be processed
        const shouldProcessStock =
          stockStatuses.isPredictaStock ||
          stockStatuses.isEmdaStock ||
          stockStatuses.hasActiveMeeting ||
          stockStatuses.isForeign ||
          stockStatuses.isPrivateShaked ||
          stockStatuses.isNonTradableShaked ||
          stockStatuses.isNotActiveShaked
        stockStatuses.shouldProcessStock = shouldProcessStock
        if (shouldProcessStock) {
          try {
            let stockSequence: string | null | undefined = stockIdTOSequence.get(stockID)
            let stock: Stock | null

            if (!stockSequence) {
              stock = await getStockByStockId(payload, stockID)
            } else {
              stock = await getCollectionDoc(req, 'stocks', stockSequence)
            }

            row.type = getStockType(row.type)

            // Determine origin with clear priority (self)
            let origin: StockOrigin = 'TASE'
            if (stockStatuses.isPrivateShaked) origin = 'Private'
            else if (stockStatuses.isForeign) origin = 'Foreign'

            // If this stock has a related parent, inherit the parent's origin regardless of current
            if (relatedStock) {
              if (privateStocksShaked.has(relatedStock)) origin = 'Private'
              else if (foreignStocksShaked.has(relatedStock)) origin = 'Foreign'
              else origin = 'TASE'
            }

            // Determine tradable status:
            // - Predicta stocks are tradable
            // - Root EMDA stocks are tradable
            // - Foreign stocks are tradable unless they are non-tradable or private
            const isTradable =
              stockStatuses.isPredictaStock ||
              stockStatuses.isPrivateShaked ||
              // stockStatuses.isRootStock ||
              (stockStatuses.hasActiveMeeting && !stockStatuses.hasRelation) ||
              stockStatuses.isNonTradableShaked ||
              stockStatuses.isForeign ||
              stockStatuses.hasForeignRelation

            stockStatuses.isTradable = isTradable
            let comments = JSON.stringify(stockStatuses)

            // Determine active status:
            // - Not active stocks are never active
            // - Stocks with meetings are active
            let isActive =
              stockStatuses.hasLatestMeeting ||
              stockStatuses.hasActiveMeeting ||
              stockStatuses.isPredictaStock ||
              stockStatuses.isPrivateShaked ||
              stockStatuses.isNotActiveShaked || //Should be active as well
              stockStatuses.isNonTradableShaked ||
              stockStatuses.isForeign

            if (!isTradable) {
              if (!stockStatuses.hasActiveMeeting) {
                // Move stock to Silenced stocks
                await insertSilenceStocks(stockID, req)
                successCount++
                return
              } else {
                // Stocks with active meetings should always be active
                isActive = true
                if (stock && !stockStatuses.hasLatestMeeting) {
                  // Add a comment for stocks with active meetings but no latest meetings
                  comments += ' Shaked, please review - has active meeting but no latest meeting'
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
              comments,
              stockStatuses.isPredictaStock,
              stockStatuses.isFinancial,
            )

            if (stockSequence) {
              stockIdTOSequence.set(stockID, stockSequence as string)
              successCount++
            } else {
              errorCount++
              await logMigrationFault({
                payload,
                severity: 'warning',
                type: 'stock',
                typeId: stockID,
                comments: 'Stock Migration Error:' + JSON.stringify(stockStatuses),
                row,
              })
            }

            // console.log(`✓ Inserted stock : ${stockID} (${successCount}/${resultStocks.recordset.length})`);
          } catch (error) {
            errorCount++
            await logMigrationFault({
              payload,
              type: 'stock',
              typeId: stockID,
              comments: createErrorFaultComment({
                operation: 'insert stock',
                id: stockID,
                error: error instanceof Error ? error : new Error(String(error)),
              }),
              row,
              severity: 'fatal',
            })
            console.error(`Error processing stock ${stockID}:`, error)
            // Don't throw the error, continue processing other stocks
          }
        } else {
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: stockID,
            comments: createStockFaultComment({
              isPredictaStock: stockStatuses.isPredictaStock,
              isEmdaStock: stockStatuses.isEmdaStock,
              hasTradableRelationStock: stockStatuses.hasTradableRelation,
              stockHasMeeting: stockStatuses.hasActiveMeeting as boolean,
            }),
            row,
            severity: 'info',
          })
        }
      })
    })

    // Wait for all stock processing to complete
    await stocksPool.waitForAll()
    successCount = 0
    errorCount = 0
    const relationStocksLength = relationStocks.size

    // Create a promise pool for stock relations with concurrency of 20
    const relationsPool = new PromisePool(20)

    Array.from(relationStocks.entries()).map(([id1, id2]) => {
      return relationsPool.add(async () => {
        try {
          const relatedStock = stockIdTOSequence.get(id2)
          const theStockToUpdate = stockIdTOSequence.get(id1)

          if (theStockToUpdate && relatedStock && !predictaStocks.has(id1)) {
            try {
              await payload.update({
                collection: 'stocks',
                id: theStockToUpdate,
                data: {
                  relatedStock: relatedStock as Stock['id'],
                },
                req: {
                  ...req,
                  context: { ...req.context, from: 'migration', process: 'migrateStocks' },
                },
              })
              successCount++
              //console.log(`✓ Inserted stock relation: ${id1} (${successCount}/${relationStocksLength})`)
            } catch (e) {
              errorCount++
              console.error(
                `x Error Inserted stock relation : ${id1} (${errorCount}/${relationStocksLength})`,
                e,
              )
            }
          } else {
            await logMigrationFault({
              payload,
              type: 'stock-relation',
              typeId: `${id1}->${id2}`,
              comments: createStockRelationFaultComment({
                stockId1: `${id1}-${theStockToUpdate}`,
                stockId2: `${id2}-${relatedStock}`,
              }),
              severity: 'warning',
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
            severity: 'fatal',
          })
          throw error
        }
      })
    })

    // Wait for all stock relation processing to complete
    await relationsPool.waitForAll()
    successCount = 0
    errorCount = 0

    // Create a promise pool with concurrency of 20 for processing stock values
    const stockValuesPool = new PromisePool(20)
    // Track skipped stocks to avoid repeated logging/processing on missing/irrelevant ones
    const skippedStockIds = new Set<string>()

    // Process each stock value individually
    resultStockValues.recordset.map((row) => {
      return stockValuesPool.add(async () => {
        row.stockID = `${row.stockID}`
        const stockID = row.stockID

        // Get stock information for this stock value
        const stockSequence = stockIdTOSequence.get(stockID)
        const isPredictaStock = predictaStocks.has(stockID)
        const isRootForeignStock = rootRelatedStocks.has(stockID) && !isPredictaStock
        const isEmdaStock = emdaStocks.has(stockID)
        const stockInMeeting = stocksInMeeting.has(stockID)

        // Skip processing if stock doesn't meet criteria
        if (
          !stockSequence ||
          (!isPredictaStock && !stockInMeeting) ||
          !!relationStocks.get(stockID)
        ) {
          if (skippedStockIds.has(stockID)) return
          // Only log first time we encounter a skipped stockID
          await logMigrationFault({
            payload,
            type: 'stock-value',
            typeId: stockID,
            comments: `Stock value not migrated - isPredictaStock: ${isPredictaStock}, isRootForeignStock: ${isRootForeignStock} isEmdaStock: ${isEmdaStock}`,
            row,
            severity: 'info',
          })
          skippedStockIds.add(stockID)
          return
        }

        try {
          await upsertStockValueFromImport(stockSequence, row, {
            ...req,
            context: { ...req.context, from: 'migration', process: 'migrateStocks' },
          })

          successCount++
          if (successCount % 1000 === 0 || successCount === resultStockValues.recordset.length) {
            console.log(
              `✓ Inserted stock value: (${successCount}/${resultStockValues.recordset.length})`,
            )
          }
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
            severity: 'fatal',
          })
          console.error(`Error processing stock value for ${stockID}:`, error)
        }
      })
    })

    // Wait for all stock value processing to complete
    await stockValuesPool.waitForAll()

    // ==============================================
    // Backfill: Latest values for main stocks (no parent) from last 5 years
    // If latest value is older than STOCK_VALUE_DAYS_RETRO, insert it (keep original valueDate)
    // ==============================================
    try {
      const daysRetro = parseInt(process.env.STOCK_VALUE_DAYS_RETRO || '30', 10)
      const cutoffDate = new Date(Date.now() - daysRetro * 24 * 60 * 60 * 1000)

      if (!pool) throw new Error('SQL pool not available for backfill query')

      const latest5YearsQuery = `
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
            FROM [dbEmda].[dbo].[stocks]
            WHERE valueDate >= DATEADD(YEAR, -5, GETDATE())
        )
        SELECT  stockID,
                [name],
                [symbol],
                [type],
                [closingRate],
                [marketValue],
                [registeredValue],
                [valueDate],
                [logUpdateID],
                [longName]
        FROM RankedStocks
        WHERE rn = 1;`

      console.log('Running latest-5-years backfill query for main stocks...')
      const latestResult = await pool.request().query(latest5YearsQuery)

      let backfillCount = 0
      let backfillSkipped = 0
      let backfillErrors = 0

      const backfillPool = new PromisePool(20)
      latestResult.recordset.map((row: any) => {
        return backfillPool.add(async () => {
          try {
            row.stockID = `${row.stockID}`
            const stockID = row.stockID

            // Only main stocks (no related parent)
            const hasParent = !!relationStocks.get(stockID)
            if (hasParent) {
              backfillSkipped++
              return
            }

            const stockSequence = stockIdTOSequence.get(stockID)
            if (!stockSequence) {
              backfillSkipped++
              return
            }

            const valueDate = new Date(row.valueDate)
            if (isNaN(valueDate.getTime())) {
              backfillErrors++
              await logMigrationFault({
                payload,
                type: 'stock-value',
                typeId: stockID,
                comments: 'Invalid valueDate in latest-5-years backfill',
                row,
                severity: 'warning',
              })
              return
            }

            // Only insert when latest value is older than the retro window
            if (valueDate >= cutoffDate) {
              backfillSkipped++
              return
            }

            await upsertStockValueFromImport(stockSequence, row, {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateStocks:backfill' },
            })
            backfillCount++
          } catch (error) {
            backfillErrors++
            await logMigrationFault({
              payload,
              type: 'stock-value',
              typeId: (row && row.stockID) || 'unknown',
              comments: createStockValueFaultComment({
                stockId: (row && row.symbol) || 'unknown',
                error: error instanceof Error ? error : new Error(String(error)),
              }),
              row,
              severity: 'fatal',
            })
          }
        })
      })

      await backfillPool.waitForAll()
      console.log(
        `Backfill summary: inserted ${backfillCount}, skipped ${backfillSkipped}, errors ${backfillErrors}`,
      )
    } catch (e) {
      console.error('Error during latest-5-years backfill step', e)
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
