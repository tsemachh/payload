import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Company } from '@/payload-types'

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
    // Transform and insert data into Payload CMS
    let successCount = 0
    let errorCount = 0
    const groupIdToMongoId = new Map<number, string>()

    for (const row of resultFirms.recordset) {
      try {
        // Transform the data to match Payload CMS format
        const companyData:Partial<Company> = {
          companyId: row.firmId,
          name: row.name,
          order: row.order,
          active: !!row.active,
          showResearch: !!row.showResearch,
          setResearchAsDefault: !!row.setResearchAsDefault,
          showResearchBond: !!row.showResearchBond,
          setResearchAsDefaultBond: !!row.setResearchAsDefaultBond,
          showResearchTrusteeship: !!row.showResearchTrusteeship,
          setResearchAsDefaultTrusteeship: !!row.setResearchAsDefaultTrusteeship,
        }

        // Check if firm already exists
        const existingCompany = await payload.find({
          collection: 'companies',
          where: {
            companyId: {
              equals: row.firmId
            }
          },
          limit: 1
        })

        if (existingCompany.docs.length > 0) {
          // Update existing firm
          await payload.update({
            collection: 'companies',
            id: existingCompany.docs[0].id,
            data: companyData,
            req,
          })
        } else {
          // Create new firm
          await payload.create({
            collection: 'companies',
            data: companyData as Company,
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
