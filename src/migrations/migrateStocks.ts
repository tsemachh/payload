import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import * as sql from 'mssql' // Changed to default import

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'your_db_user', // Replace with your actual database user
  password: 'your_db_password', // Replace with your actual database password
  server: 'your_db_server', // Replace with your actual database server
  database: 'dbEmda', // Replace with your actual database name
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // For self-signed certificates
  },
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    // Connect to SQL Server
    await sql.connect(sqlConfig)

    // Query the last 30 days of data
    const result = await sql.query`
      SELECT stockID, name, symbol, type, closingRate, marketValue, registeredValue, valueDate, logUpdateID, longName
      FROM [dbEmda].[dbo].[stocks]
      WHERE [valueDate] >= DATEADD(DAY, -30, GETDATE());
    `

    // Transform and insert data into Payload CMS
    for (const row of result.recordset) {
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
        status: 'active', // Default status
      }

      // Insert into Payload CMS
      await payload.create({
        collection: 'stocks',
        data: {
          ...stockData,
          status: stockData.status as 'active' | 'suspended' | 'delisted' | null | undefined, // Ensure status is of the correct type
        },
        req,
      })

      console.log(`Inserted stock: ${row.symbol}`)
    }

    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Error during migration:', error)
  } finally {
    // Close SQL Server connection
    await sql.close()
  }
}

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
