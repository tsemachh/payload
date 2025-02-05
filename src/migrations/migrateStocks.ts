import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock } from '@/payload-types' // Then you can use sql.close() directly

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'master', // Change this to your database name once created
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true // For local dev
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

    // Query the last 30 days of data
    console.log('Executing SQL query for last 30 days of stock data...')
    const result = await pool.request().query(`
      SELECT stockID, name, symbol, type, closingRate, marketValue, registeredValue, valueDate, logUpdateID, longName
      FROM [dbEmda].[dbo].[stocks]
      WHERE [valueDate] >= DATEADD(DAY, -30, GETDATE());
    `)
    console.log(`Retrieved ${result.recordset.length} records from SQL Server`)

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0

    for (const row of result.recordset) {
      try {
        // @ts-ignore
        const stockData:Stock = {
          id:row.stockID,
          stockID: row.stockID,
          name: row.name,
          symbol: row.symbol,
          type: row.type,
          closingRate: row.closingRate,
          marketValue: row.marketValue,
          registeredValue: row.registeredValue,
          valueDate: row.valueDate,
          longName: row.longName
        }

        // Insert into Payload CMS
        await payload.create({
          collection: 'stocks',
          data: stockData,
          req,
        })

        successCount++
        console.log(`✓ Inserted stock: ${row.symbol} (${successCount}/${result.recordset.length})`)
      } catch (insertError) {
        errorCount++
        console.error(`✗ Failed to insert stock ${row.symbol}:`, insertError)
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
