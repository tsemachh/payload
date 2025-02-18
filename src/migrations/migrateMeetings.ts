// import { MigrateUpArgs } from '@payloadcms/db-mongodb'
// import sql from 'mssql'
// import { Meeting } from '@/payload-types'
// import { getSeqeunceMeetingId, getSeqeunceStockId } from '../utils/utils' // Then you can use sql.close() directly

// // SQL Server configuration
// const sqlConfig: sql.config = {
//   user: 'sa',
//   password: 'dockerStrongPwd123',
//   database: 'master', // Change this to your database name once created
//   server: 'localhost',
//   port: 1433,
//   options: {
//     encrypt: false, // For local dev, set to false
//     trustServerCertificate: true // For local dev
//   }
// }

// export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
//   let pool: sql.ConnectionPool | null = null

//   try {
// /*    await payload.delete({
//       collection: 'meetings',
//       where: {},
//     });*/
//     console.log('Starting migration process...')
//     console.log('Attempting to connect to SQL Server:', sqlConfig.server)

//     // Connect to SQL Server
//     pool = await sql.connect(sqlConfig)
//     console.log('Successfully connected to SQL Server')
//     if (pool === null){
//       console.error('Error no pool ,Executing SQL query for meetings.')
//       return
//     }
//     // Query the last 30 days of data
//     console.log('Executing SQL query for meetings.')
//     const result = await pool?.request().query(`
//         SELECT  [id]
//              ,[proofId]
//              ,[mdate]
//              ,[sdate]
//              ,[proxyStatementDate]
//              ,[stockID]
//              ,[memourl]
//              ,[link2]
//              ,[location]
//              ,[mtype]
//              ,[comments]
//              ,[ResultConfirm]
//              ,[ElectronicVoting]
//              ,[mIdConnection]
//              ,[CommiteeRequest]
//         FROM [dbEmda].[dbo].[meetings];
//     `)
//     console.log(`Retrieved ${result?.recordset?.length} records from SQL Server`)

//     // Transform and insert data into Payload CMS
//     console.log('Starting data transformation and insertion into Payload CMS...')
//     let successCount = 0
//     let errorCount = 0

//     for (const row of result.recordset) {
//       try {
//         // console.log("Row",JSON.stringify(row, null, 2))

//         //Find stockId
//         const stockId = await getSeqeunceStockId(payload, row.stockID)
//         if (stockId === null){
//           console.log("Stockid can't be found:",row.stockID)
//           continue;
//         }

//         //Find relatedf meeting Id
//         const relatedMeetingId = await getSeqeunceMeetingId(payload, row.mIdConnection)
//         // @ts-ignore
//         const meetingData:Meeting = {
//           meetingId:row.id,
//           stock:stockId as string,
//           proofId:row.proofId,
//           meetingDate:row.mdate,
//           holdingsLimit:row.sdate,
//           proxyStatementDate:row.proxyStatementDate,
//           votingDocUrl:row.memourl,
//           meetingInviteUrl:row.link2,
//           location:row.location,
//           comments:row.comments,
//           relatedMeetingId:relatedMeetingId,
//           committeeInitiated:!!row.CommiteeRequest,
//         }

//         //console.log("Data",JSON.stringify(meetingData, null, 2))
//         const id = await getSeqeunceMeetingId(payload, meetingData.meetingId)
//         if (id){
//           // Update Payload CMS
//           await payload.update({
//             collection: 'meetings',
//             id: id,
//             data: meetingData,
//             req,
//           })
//         }else{
//           // Insert into Payload CMS
//           await payload.create({
//             collection: 'meetings',
//             data: meetingData,
//           })
//         }

//         successCount++
//         console.log(`✓ Inserted Meeting: ${row.id} (${successCount}/${result.recordset.length})`)
//       } catch (insertError) {
//         console.log("Row",JSON.stringify(row, null, 2))
//         errorCount++
//         console.error(`✗ Failed to insert Meetingds ${row.id}:`, insertError)
//         return;
//       }
//     }

//     console.log('\nMigration Summary:')
//     console.log(`Total records processed: ${result.recordset.length}`)
//     console.log(`Successfully inserted: ${successCount}`)
//     console.log(`Failed insertions: ${errorCount}`)
//     console.log('Migration completed successfully.')
//   } catch (error) {
//     console.error('Critical error during migration:', error)
//     throw error // Re-throw to ensure migration is marked as failed
//   } finally {
//     console.log('Closing SQL Server connection...')
//     if (pool) {
//       await pool.close() // Close the connection pool
//     }
//     console.log('SQL Server connection closed')
//   }
// }

// // export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
// //   // Implement the down migration if needed
// //   // This should ideally revert any changes made in the up function
// // }
