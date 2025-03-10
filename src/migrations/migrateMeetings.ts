import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Meeting, MeetingState, MeetingType } from '@/payload-types'
import { getSequenceMeetingId,  getSeqeunceStockId } from '@/utils/utils' // Then you can use sql.close() directly
import { logMigrationFault } from '@/utils/migrationFaultUtils'
// Define the mapping for TypeId to newType and newState
const typeMappings = new Map<number, { newType: string | null; newState: string | null }>([
  [-1, { newType: null, newState: null }],
  [1, { newType: 'שנתית', newState: null }],
  [2, { newType: 'שנתית', newState: 'postponed' }],
  [4, { newType: 'מיוחדת', newState: null }],
  [5, { newType: 'מיוחדת', newState: 'postponed' }],
  [7, { newType: 'אג"ח', newState: null }],
  [8, { newType: 'אג"ח', newState: 'postponed' }],
  [9, { newType: 'אג"ח', newState: 'ongoing' }],
  [10, { newType: 'אופציה', newState: null }],
  [11, { newType: 'אופציה', newState: 'postponed' }],
  [13, { newType: 'יחידת השתתפות', newState: null }],
  [14, { newType: 'יחידת השתתפות', newState: 'postponed' }],
  [16, { newType: 'תעודת סל', newState: null }],
  [17, { newType: 'תעודת סל', newState: 'postponed' }],
  [19, { newType: null, newState: 'cancelled' }],
  [20, { newType: null, newState: 'on-hold' }],
  [30, { newType: 'אג"ח כהונת נאמן', newState: null }],
])

// Function to get newType and newState based on TypeId
function getTypeAndState(typeId: number): { newType: string | null; newState: string | null } {
  const mapping = typeMappings.get(typeId);
  if (mapping) {
    return mapping;
  } else {
    throw new Error(`TypeId ${typeId} not found in mappings.`);
  }
}

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
    /*    await payload.delete({
          collection: 'meetings',
          where: {},
        });*/
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')
    if (pool === null){
      console.error('Error no pool ,Executing SQL query for meetings.')
      return
    }
    // Query the last 30 days of data
    console.log('Executing SQL query for meetings.')
    const result = await pool?.request().query(`
        SELECT  [id]
             ,[proofId]
             ,[mdate]
             ,[sdate]
             ,[proxyStatementDate]
             ,[stockID]
             ,[memourl]
             ,[link2]
             ,[location]
             ,[mtype]
             ,[comments]
             ,[ResultConfirm]
             ,[ElectronicVoting]
             ,[mIdConnection]
             ,[CommiteeRequest]
        FROM [dbEmda].[dbo].[meetings];
    `)
    console.log(`Retrieved ${result?.recordset?.length} records from SQL Server`)

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0

    for (const row of result.recordset) {
      try {
        // console.log("Row",JSON.stringify(row, null, 2))
        row.stockID=`${row.stockID}`
        //Find stockId
        const stockId = await getSeqeunceStockId(payload, row.stockID)
        if (stockId === null){
          console.log("Stockid can't be found:",row.stockID)
          await logMigrationFault({
            payload,
            type: 'meeting',
            typeId: `${row.id}`,
            comments: `Meeting with ID ${row.id} has stockId ${row.stockID} that can't be found and will not be imported`,
            row
          })
          continue;
        }
        //Find meetingTypeId
        // eslint-disable-next-line prefer-const
        let { newType, newState } = getTypeAndState(row.mtype);
        const meetingDate=new Date(row.mdate)
        const now = new Date()
        if (newState == null){
          newState=(meetingDate > now ? "scheduled":"completed")
        }
        switch (newState) {
          case 'postponed':
          case 'ongoing':
            if (meetingDate <  now) {
              newState= 'completed'
            }
            break
          case 'on-hold':
            row.mdate = null
            break
        }

        if (row.mdate == null && newState != 'on-hold'){
          //Here Junie report to migration-fault the error
          await logMigrationFault({
            payload,
            type: 'meeting',
            typeId: `${row.id}`,
            comments: `Meeting with ID ${row.id} has null mdate and will not be imported`,
            row
          })
          continue
        }
        // @ts-ignore
        const meetingData:Meeting = {
          meetingId:row.id,
          stock:stockId as string,
          magnaId:row.proofId,
          meetingDate:row.mdate,
          holdingsLimit:row.sdate,
          proxyVotingDate:row.proxyStatementDate,
          location:row.location,
          type:newType as MeetingType,
          state:newState as MeetingState,
          comments:row.comments,
          resultsConfirmationStatus:!!row.ResultConfirm,
          electronicVotingEnabled:!!row.ElectronicVoting,
          committeeInitiated:!!row.CommiteeRequest,
          _status:"published"
        }

        //console.log("Data",JSON.stringify(meetingData, null, 2))
        const id = await getSequenceMeetingId(payload, meetingData.meetingId as string)
        if (id){
          // Update Payload CMS
          payload.update({
            collection: 'meetings',
            id: id,
            data: meetingData,
            req,
          })
        }else{
          // Insert into Payload CMS
          payload.create({
            collection: 'meetings',
            data: meetingData,
          })
        }

        successCount++
        console.log(`✓ Inserted Meeting: ${row.id} (${successCount}/${result.recordset.length})`)
      } catch (insertError) {
        console.log("Row",JSON.stringify(row, null, 2))
        errorCount++
        console.error(`✗ Failed to insert Meetingds ${row.id}:`, insertError)
        return;
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
