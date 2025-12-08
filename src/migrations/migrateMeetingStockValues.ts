import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { createMSSqlPool } from '@/migrations/utils/utils'
import { PromisePool } from '@/utils/promisePool'
import { upsertStockValueFromImport } from '@/migrations/utils/migrateUtils'
import { getIdOfRelationField } from '@/utils/utils'
import { Stock } from '@/payload-types'
import {
  createStockValueFaultComment,
  logMigrationFault,
} from '@/migrations/utils/migrationFaultUtils'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration to link meetings with stock values...')
    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for stock values.')
      return
    }

    // Get all NON-finalized meetings missing stockValue
    console.log('Fetching all non-finalized meetings (missing stockValue)...')
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        stock: true,
        holdingsLimit: true,
        type: true,
      },
      where: {
        and: [{ stockValue: { exists: false } }, { finalized: { not_equals: true } }],
      },
      limit: 0,
      depth: 1,
    })

    console.log(`Retrieved ${meetings.docs.length} meetings from database`)

    // Create a promise pool with concurrency of 20
    const promisePool = new PromisePool(20)
    let successCount = 0
    let errorCount = 0

    // Process each meeting
    for (const meeting of meetings.docs) {
      promisePool.add(async () => {
        try {
          const holdingsLimit = meeting.holdingsLimit

          let stockId = getIdOfRelationField(meeting.stock)
          // Get stock details
          const stock = meeting.stock as Stock

          if (!stock) {
            console.log(`Stock ${stock} not found, skipping meeting ${meeting.id}`)
            return
          }

          // Determine if this is a future meeting
          const now = new Date()
          const isFutureMeeting = holdingsLimit ? new Date(holdingsLimit as string) > now : false

          // For future meetings, get the latest stock value
          // For past meetings, get the stock value at the holdings limit date
          const dateToUse = isFutureMeeting ? null : holdingsLimit

          // Determine SQL stock ID to use (default to the meeting stock’s own MSSQL id)
          let sqlStockId = stock.stockId

          // If the meeting stock is a dual stock, try to use its source stock's MSSQL ID first
          if ((stock as any)?.isDual === true) {
            try {
              const sourceRes = await payload.find({
                collection: 'stocks',
                where: {
                  and: [{ hasDual: { equals: true } }, { dualStock: { equals: stockId } }],
                },
                limit: 1,
                depth: 0,
              })

              const sourceStock = (sourceRes?.docs?.[0] || null) as unknown as Stock | null

              if (sourceStock?.stockId && /^\d+$/.test(sourceStock.stockId)) {
                sqlStockId = sourceStock.stockId
                stockId = sourceStock.id
                console.log(
                  `Meeting ${meeting.id}: dual stock detected. Using source stock ${sourceStock.id} (MSSQL ID ${sqlStockId}) for value lookup.`,
                )
              } else if (sourceStock) {
                console.log(
                  `Meeting ${meeting.id}: source stock ${sourceStock.id} has non-numeric MSSQL ID ${sourceStock.stockId}. Falling back to dual stock MSSQL ID ${stock.stockId}.`,
                )
              } else {
                console.log(
                  `Meeting ${meeting.id}: no source stock found for dual stock ${stock.id}. Using dual stock MSSQL ID ${stock.stockId}.`,
                )
              }
            } catch (e) {
              console.log(
                `Meeting ${meeting.id}: error looking up source stock for dual stock ${stock.id}. Using dual stock MSSQL ID ${stock.stockId}.`,
                e,
              )
            }
          }

          // Single numeric check on the final sqlStockId
          if (!/^\d+$/.test(sqlStockId)) {
            console.log(`Stock ${sqlStockId} has non-numeric ID, skipping meeting ${meeting.id}`)
            return
          }

          // Query MSSQL for stock data
          let stockData
          if (dateToUse) {
            // Get stock data for the specific date
            const query = `
                SELECT TOP 1
                    stockID,
                    name,
                    symbol,
                    type,
                    CAST(closingRate AS DECIMAL(18,2)) AS closingRate,
                    CAST(marketValue AS DECIMAL(18,2)) AS marketValue,
                    CAST(registeredValue AS DECIMAL(18,2)) AS registeredValue,
                    valueDate,
                    logUpdateID,
                    longName
                FROM [dbEmda].[dbo].[stocks]
                WHERE stockID = @stockId
                  AND valueDate <= @valueDate
                ORDER BY valueDate DESC
            `
            const request = pool?.request()
            if (request) {
              request.input('stockId', sql.VarChar, sqlStockId)
              request.input('valueDate', sql.DateTime, new Date(dateToUse as string).toISOString())
            }
            const result = await request?.query(query)
            if (result) stockData = result.recordset.length > 0 ? result?.recordset[0] : null
          } else {
            // Get the latest stock value
            const query = `
              SELECT TOP 1 stockID,
                     name,
                     symbol,
                     type,
                     CAST(closingRate AS DECIMAL(18,2)) AS closingRate,
                     CAST(marketValue AS DECIMAL(18,2)) AS marketValue,
                     CAST(registeredValue AS DECIMAL(18,2)) AS registeredValue,
                     valueDate,
                     logUpdateID,
                     longName
              FROM [dbEmda].[dbo].[stocks]
              WHERE stockID = @stockId
              ORDER BY valueDate DESC
            `
            const request = pool?.request()
            if (request) {
              request.input('stockId', sql.Int, sqlStockId)
            }
            const result = await request?.query(query)
            if (result) stockData = result.recordset.length > 0 ? result.recordset[0] : null
          }

          if (!stockData) {
            console.log(
              `No stock data found for stock ${stock.stockId} at date ${dateToUse || 'latest'}, skipping meeting ${meeting.id}`,
            )
            return
          }
          let stockValueId
          try {
            // Upsert stock value
            stockValueId = await upsertStockValueFromImport(stockId as string, stockData, {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateMeetingsStockValue' },
            })
          } catch (e) {
            console.log(
              'Error with upsertStockValueFromImport:' + stockId,
              JSON.stringify(stockData),
            )
            // Also report to migrationFaults with type 'stock-value'
            await logMigrationFault({
              payload,
              type: 'stock-value',
              typeId: String(stockId),
              comments: createStockValueFaultComment({
                stockId: String(stockId),
                error: e as Error,
              }),
              row: JSON.stringify(stockData),
              severity: 'error',
            })
          }
          const stockName = `${stockData?.name} - ${stockData?.stockID}`
          const fullName = `${stockName}-${meeting?.type ? meeting.type : 'נדחתה/בוטלה'}`

          // Update meeting with stock value relation
          await payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: {
              stockValue: stockValueId,
              fullName: fullName,
            },
            req: {
              ...req,
              context: { ...req.context, from: 'migration', process: 'migrateMeetingsStockValues' },
            },
          })

          successCount++
          if (successCount % 100 === 0 || successCount === meetings.docs.length) {
            console.log(
              `✓ Updated ${successCount}/${meetings.docs.length} meetings with stock values`,
            )
          }
        } catch (error) {
          errorCount++
          console.error(`Error processing meeting ${meeting.id}:`, error)
        }
      })
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()

    console.log('\nMigration Summary:')
    console.log(`Total meetings processed: ${meetings.docs.length}`)
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

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
