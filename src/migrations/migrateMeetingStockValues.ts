import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import * as sql from 'mssql'
import { createMSSqlPool } from '@/migrations/utils/utils'
import { PromisePool } from '@/utils/promisePool'
import { upsertStockValueFromImport } from '@/migrations/utils/migrateUtils'
import { getIdOfRelationField } from '@/utils/utils'
import { Stock } from '@/payload-types'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration to link meetings with stock values...')
    pool = await createMSSqlPool()

    if (pool === null) {
      console.error('Error no pool, Executing SQL query for stock values.')
      return
    }

    // Get all meetings
    console.log('Fetching all meetings...')
    const meetings = await payload.find({
      collection: 'meetings',
      select: {
        stock: true,
        holdingsLimit: true,
        type: true,
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

          const stockId = getIdOfRelationField(meeting.stock)
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

          // Check if stock.stockId is numeric
          if (!/^\d+$/.test(stock.stockId)) {
            console.log(`Stock ${stock.stockId} has non-numeric ID, skipping meeting ${meeting.id}`)
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
              request.input('stockId', sql.VarChar, stock.stockId)
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
              request.input('stockId', sql.VarChar, stock.stockId)
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

          // Upsert stock value
          const stockValueId = await upsertStockValueFromImport(
            stockId as string,
            stockData,
            req,
            true,
          )
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
              context: { ...req.context, from: 'migration' },
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
