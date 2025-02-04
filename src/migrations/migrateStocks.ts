import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql' // Then you can use sql.close() directly

// SQL Server configuration
const sqlConfig: sql.config = {
  server: 'LENOVOP15S', // Your database server
  database: 'master', // Your database name
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // For self-signed certificates
  },
  authentication: {
    type: 'ntlm',
    options: {
      domain: '', // Leave empty if not using a domain
      userName: '', // Leave empty if using integrated security
      password: '', // Leave empty if using integrated security
    },
  },
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Query the last 30 days of data
    console.log('Executing SQL query for last 30 days of stock data...')
    const result = await sql.query`
      SELECT stockID, name, symbol, type, closingRate, marketValue, registeredValue, valueDate, logUpdateID, longName
      FROM [dbEmda].[dbo].[stocks]
      WHERE [valueDate] >= DATEADD(DAY, -30, GETDATE());
    `
    console.log(`Retrieved ${result.recordset.length} records from SQL Server`)

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0

    for (const row of result.recordset) {
      try {
        const stockData = {
          stockID: row.stockID,
          name: row.name,
          symbol: row.symbol,
          type: row.type,
          closingRate: row.closingRate,
          marketValue: row.marketValue,
          registeredValue: row.registeredValue,
          valueDate: row.valueDate,
          logUpdateID: row.logUpdateID,
          longName: row.longName,
          status: 'active' as 'active' | 'suspended' | 'delisted',
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
    await sql.pool.close() // Changed from sql.close() to sql.pool.close()
    console.log('SQL Server connection closed')
  }
}
// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
