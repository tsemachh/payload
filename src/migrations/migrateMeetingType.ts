import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { MeetingType,  } from '@/payload-types'
import {  getSeqeunceMeetingType,  } from '../utils/utils' // Then you can use sql.close() directly

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
    await payload.delete({
      collection: 'meeting-types',
      where: {},
    });
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Query the last 30 days of data
    console.log('Executing SQL query for meetings.')
    const result = await pool.request().query(`
        SELECT [TypeId]
             ,[Name]
             ,[GroupId]
             ,[GroupName]
        FROM [dbEmda].[dbo].[MeetingType]
        `)
    console.log(`Retrieved ${result.recordset.length} records from SQL Server`)

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0

    for (const row of result.recordset) {
      try {

        // @ts-ignore
        console.log("Row",JSON.stringify(row, null, 2))

        const data:{ name: any; id: any; group: any } = {
          id: row.TypeId,
          name: row.Name,
          group: row.GroupId
        }
        console.log("Data",JSON.stringify(data, null, 2))
        const id = await getSeqeunceMeetingType(payload, data.id)
        if (id){
          // Update Payload CMS
          await payload.update({
            collection: 'meeting-types',
            id: id,
            data: data,
            req,
          })
        }else{
          // Insert into Payload CMS
          await payload.create({
            collection: 'meeting-types',
            data: data,
          })
        }

        successCount++
        console.log(`✓ Inserted Meeting Type: ${row.name} (${successCount}/${result.recordset.length})`)
      } catch (insertError) {
        errorCount++
        console.error(`✗ Failed to insert Meetingds ${row.meetingId}:`, insertError)
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
