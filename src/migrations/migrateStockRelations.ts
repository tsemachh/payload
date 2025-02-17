import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { getSeqeunceStockId } from '../utils/utils' // Then you can use sql.close() directly

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

    // Query the last 30 days of data
    console.log('Executing SQL query for last 30 days of stock data...')
    const result = await pool.request().query(`
        SELECT [Id1], [Id2]
        FROM [dbEmda].[dbo].[tblSecurityIdConnections]
    `)
    console.log(`Retrieved ${result.recordset.length} records from SQL Server`)
    const resultEmdaStockIds = await pool.request().query(`
        SELECT distinct [stockID]
        FROM [dbEmda].[dbo].[stocks] stocks
        WHERE stocks.logUpdateID = 5961
    `)
    const predictaStocks:Set<string>=new Set()
    for (const row of resultEmdaStockIds.recordset) {
      predictaStocks.add(row.stockID);
      const theStockToUpdate = await getSeqeunceStockId(payload, parseInt(row.stockID))
      if (theStockToUpdate) {
        await payload.update({
          collection: 'stocks',
          id: theStockToUpdate,
          // @ts-ignore
          data: { tradable: true },
          req,
        })
      }
    }
    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    for (const row of result.recordset) {
      try {
        const theStockToUpdate = await getSeqeunceStockId(payload, parseInt(row.Id2))
        const relatedStock = await getSeqeunceStockId(payload, parseInt(row.Id1))

        if (theStockToUpdate && relatedStock) {
          await payload.update({
            collection: 'stocks',
            id: theStockToUpdate,
            // @ts-ignore
            data: { relatedStock: relatedStock },
            req,
          })
          successCount++
          console.log(
            `✓ Inserted stock relation: ${row.Id2} (${successCount}/${result.recordset.length})`,
          )
        } else {
          errorCount++
          console.log(
            `✗ Failed to insert stock relation ${row.Id2} (${successCount}/${result.recordset.length})`,
          )
        }
      } catch (insertError) {
        errorCount++
        console.error(`✗ Failed to insert stock ${row.symbol}:`, insertError)
        throw insertError
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total records processed: ${result.recordset.length}`)
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
