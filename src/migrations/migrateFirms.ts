import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Firm, FirmsGroup } from '@/payload-types'

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'dbEmda', // Use dbEmda database
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
}

interface FirmRow {
  firmId: number
  name: string
  order: number
  active: boolean
  showResearch: boolean
  setResearchAsDefault: boolean
  showResearchBond: boolean
  setResearchAsDefaultBond: boolean
  showResearchTrusteeship: boolean
  setResearchAsDefaultTrusteeship: boolean
}

interface GroupToFirmRow {
  group_id: number
  firm_id: number
}

async function getFirms(pool: sql.ConnectionPool): Promise<sql.IResult<FirmRow>> {

  const result = await pool.request().query(`
    SELECT 
      [id] as firmId,
      [name] as name,
      [idOrder] as [order],
      [firm_active] as active,
      [showResearch] as showResearch,
      [setResearchAsDefault] as setResearchAsDefault,
      [showResearchBond] as showResearchBond,
      [setResearchAsDefaultBond] as setResearchAsDefaultBond,
      [showResearchTrusteeship] as showResearchTrusteeship,
      [setResearchAsDefaultTrusteeship] as setResearchAsDefaultTrusteeship
        FROM [dbEmda].[dbo].[firms]
    ORDER BY [FirmID]
  `)
  return result
}

async function getFirmsToGroups(pool: sql.ConnectionPool): Promise<Map<number, number[]>> {

  const result = await pool.request().query(`
    SELECT [group_id]
           ,[firm_id]
      FROM [dbEmda].[dbo].[groupstofirms] ORDER BY [firm_id]
  `)

  const firmToGroups = new Map<number, number[]>()
  result.recordset.forEach(row => {
    const groups = firmToGroups.get(row.firm_id) || []
    groups.push(row.group_id)
    firmToGroups.set(row.firm_id, groups)
  })
  return firmToGroups
}

async function getFirmGroups(pool: sql.ConnectionPool): Promise<sql.IResult<FirmsGroup>> {

  const result = await pool.request().query(`
      SELECT TOP (1000) [group_id] as groupId
                      ,[group_name] as name
      FROM [dbEmda].[dbo].[groups]
      `)

  return result
}
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Get firms data from SQL Server
    const resultFirms = await getFirms(pool)
    console.log(`Retrieved ${resultFirms.recordset.length} firms from SQL Server`)
    const resultFirmsGroups= await getFirmGroups(pool)
    const firmsToGroup=await getFirmsToGroups(pool)
    // Transform and insert data into Payload CMS
    let successCount = 0
    let errorCount = 0
    const groupIdToMongoId = new Map<number, string>()
    for (const row of resultFirmsGroups.recordset) {
      try {
        // Check if group already exists
        const existingGroup = await payload.find({
          collection: 'firms-groups',
          where: {
            groupId: {
              equals: row.groupId
            }
          }
        })

        const groupData = {
          groupId: row.groupId,
          name: row.name
        }

        if (existingGroup.docs.length > 0) {
          // Update existing group
          await payload.update({
            collection: 'firms-groups',
            id: existingGroup.docs[0].id,
            data: groupData,
            req,
          })
          groupIdToMongoId.set(row.groupId, existingGroup.docs[0].id)
        } else {
          // Create new group
          const newGroup = await payload.create({
            collection: 'firms-groups',
            data: groupData,
            req,
          })
          groupIdToMongoId.set(row.groupId, newGroup.id)
        }

        successCount++
        console.log(`✓ Processed group: ${row.groupId} (${successCount}/${resultFirmsGroups.recordset.length})`)
      } catch (error) {
        errorCount++
        console.error(`✗ Error processing group ${row.groupId}:`, error)
      }
    }

    for (const row of resultFirms.recordset) {
      try {
        // Transform the data to match Payload CMS format
        // Get group IDs for this firm and convert them to MongoDB IDs
        const groupIds = firmsToGroup.get(row.firmId) || []
        const groupMongoIds = groupIds
          .map(groupId => groupIdToMongoId.get(groupId))
          .filter(id => id !== undefined) // Remove any undefined values

        const firmData:Partial<|Firm> = {
          firmId: row.firmId,
          name: row.name,
          order: row.order,
          active: !!row.active,
          showResearch: !!row.showResearch,
          setResearchAsDefault: !!row.setResearchAsDefault,
          showResearchBond: !!row.showResearchBond,
          setResearchAsDefaultBond: !!row.setResearchAsDefaultBond,
          showResearchTrusteeship: !!row.showResearchTrusteeship,
          setResearchAsDefaultTrusteeship: !!row.setResearchAsDefaultTrusteeship,
          groups: groupMongoIds as string[], // Add the groups reference
        }

        // Check if firm already exists
        const existingFirm = await payload.find({
          collection: 'firms',
          where: {
            firmId: {
              equals: row.firmId
            }
          }
        })

        if (existingFirm.docs.length > 0) {
          // Update existing firm
          await payload.update({
            collection: 'firms',
            id: existingFirm.docs[0].id,
            data: firmData,
            req,
          })
        } else {
          // Create new firm
          await payload.create({
            collection: 'firms',
            data: firmData as Firm,
            req,
          })
        }

        successCount++
        console.log(`✓ Processed firm: ${row.firmId} (${successCount}/${resultFirms.recordset.length})`)
      } catch (error) {
        errorCount++
        console.error(`✗ Error processing firm ${row.firmId}:`, error)
      }
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
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
