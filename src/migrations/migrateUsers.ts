import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Company, User, UserCompany } from '@/payload-types'
import { logMigrationFault } from '@/utils/migrationFaultUtils'

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'dbEmda',
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
}

// Migration script for users from SQL Server to Payload CMS
// Handles:
// 1. Basic user data from users table
// 2. User-firm relationships from userstofirms table
// 3. User profile data including IP, permissions, and settings
// 4. QR code lifecycle data
//
// SQL Data Interfaces
interface UserRow {
  id: number
  user: string
  userType: number
}

interface UserToFirmRow {
  userID: number
  firmID: number
  emailOnNoHoldings: boolean
  votePermission: boolean
}

interface UserProfileRow {
  UserId: number
  UserName: string
  UserType: number
  UserIP: string
  ChangePassword: boolean
  ShowQr: boolean
  LastLogin: string
}

interface UserProfileCodeRow {
  UserId: number
  CreateDate: Date
  LastCodeFailureDate: Date
  CodeFailuresSinceLastSuccess: number
}

// SQL Query Functions
async function getUsers(pool: sql.ConnectionPool): Promise<UserRow[]> {
  const result = await pool.request().query(`
    SELECT TOP (1000) [id]
      ,[user]
      ,[userType]
    FROM [${sqlConfig.database}].[dbo].[users]
  `)
  return result.recordset
}

async function getUsersToFirms(pool: sql.ConnectionPool): Promise<UserToFirmRow[]> {
  const result = await pool.request().query(`
    SELECT [userID]
      ,[firmID]
      ,[emailOnNoHoldings]
      ,[votePermission]
    FROM [${sqlConfig.database}].[dbo].[userstofirms]
  `)
  return result.recordset
}

async function getUserProfiles(pool: sql.ConnectionPool): Promise<UserProfileRow[]> {
  const result = await pool.request().query(`
    SELECT [UserId]
      ,[UserName]
      ,[UserType]
      ,[UserIP]
      ,[ChangePassword]
      ,[ShowQr]
      ,[LastLogin]
    FROM [${sqlConfig.database}].[dbo].[UserProfile]
  `)
  return result.recordset
}

async function getUserProfileCodes(pool: sql.ConnectionPool): Promise<UserProfileCodeRow[]> {
  const result = await pool.request().query(`
    SELECT [UserId]
      ,[CreateDate]
      ,[LastCodeFailureDate]
      ,[CodeFailuresSinceLastSuccess]
    FROM [${sqlConfig.database}].[dbo].[UserProfileCode]
  `)
  return result.recordset
}

// Migration Function
// Processes users in the following order:
// 1. Fetches all required data from SQL tables
// 2. For each user:
//    - Gets related profile and QR code data
//    - Processes firm relationships (skips invalid firms)
//    - Creates user with all related data
// 3. Logs any errors as migration faults
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting users migration process...')
  let successCount = 0
  let errorCount = 0
  let createdCount = 0
  let updatedCount = 0
  let pool: sql.ConnectionPool | null = null

  try {
    // Connect to SQL Server
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Fetch all data
    const usersToFirms = await getUsersToFirms(pool)
    const userProfiles = await getUserProfiles(pool)
    const userProfileCodes = await getUserProfileCodes(pool)
    let userData: Partial<User>={}
    // Process each user
    for (const userProfile of userProfiles) {
      try {
        // Get related data

        const userProfileCode = userProfileCodes.find(p => p.UserId === userProfile.UserId)
        const userFirms = usersToFirms.filter(f => f.userID === userProfile.UserId)

        // Transform companies data
        const companies: {
          companyId: string | Company;
          permission?: ('read' | 'write') | null;
          id?: string | null;
        }[] = []
        for (const firm of userFirms) {
          try {
            // Find the firm in the new system
            const existingCompany = await payload.find({
              collection: 'companies',
              where: {
                companyId: {
                  equals: firm.firmID.toString()
                }
              }
            })

            if (!existingCompany.docs.length) {
              await logMigrationFault({
                payload,
                type: 'user',
                typeId: userProfile.UserId.toString(),
                comments: `Referenced firm with ID ${firm.firmID} not found`
              })
              console.warn(`⚠ Skipping firm ${firm.firmID} for user ${userProfile.UserName} - firm not found`)
              continue
            }

            // Create a new object with the correct property name
            const companyObj = {
              companyId: existingCompany.docs[0].id,
              permission: 'write' as const
            };
            companies.push(companyObj)
          } catch (error) {

            await logMigrationFault({
              payload,
              type: 'user',
              typeId: userProfile.UserId.toString(), // @ts-ignore
              comments: `Error processing firm ${firm.firmID}: ${error.message}`
            })
            console.error(`✗ Error processing firm ${firm.firmID} for user ${userProfile.UserName}:`, error)
          }
        }

        // Check if userAuth already exists
        const existingUser = await payload.find({
          collection: 'users',
          where: {
            email: {
              equals: userProfile.UserName.toLowerCase().trim()
            }
          }
        })

        // Prepare userAuth data with all required fields
        userData= {
          // Basic userAuth information
          name: userProfile.UserName.toLowerCase().trim(),
          email: userProfile.UserName.toLowerCase().trim(),
          legacyId: userProfile.UserId,

          // User type and permissions
          isAdmin: userProfile.UserType === 1,
          // Firm relationships
          companies: companies,
          // Profile settings
          userIp: userProfile?.UserIP || '',
          changePassword: !!userProfile?.ChangePassword ,
          lastLogin: userProfile?.LastLogin as string | null | undefined,
          // QR code lifecycle data
          qrCodeData: userProfileCode ? {
            showQr: !!userProfile?.ShowQr,
            createDate: userProfileCode.CreateDate ? new Date(userProfileCode.CreateDate).toISOString() : null,
            lastCodeFailureDate: userProfileCode.LastCodeFailureDate ? new Date(userProfileCode.LastCodeFailureDate).toISOString() : null,
            codeFailuresSinceLastSuccess: userProfileCode.CodeFailuresSinceLastSuccess
          } : undefined,

          // Authentication settings
          loginAttempts: 0,
        }

        // Validate critical data
        const validationIssues = []

        // Validate required fields
        if (!userProfile.UserName) validationIssues.push('Missing user email')
        if (!userProfile.UserType) validationIssues.push('Missing user type')
        if (!userProfile.UserId) validationIssues.push('Missing user ID')

        // If there are validation issues, log them and skip this user
        if (validationIssues.length > 0) {
          await logMigrationFault({
            payload,
            type: 'user',
            typeId: userProfile.UserId ? userProfile.UserId.toString() : 'unknown',
            comments: `Validation failed: ${validationIssues.join(', ')}`,
            row: JSON.stringify(userProfile, null, 2)
          })
          console.warn(`⚠ Skipping user due to validation issues: ${validationIssues.join(', ')}`)
          continue
        }


        let newUser
        if (existingUser.docs.length > 0) {
          // Update existing userAuth
          newUser = await payload.update({
            collection: 'users',
            id: existingUser.docs[0].id,
            data: userData
          })
        } else {
          // Create new userAuth
          newUser = await payload.create({
            collection: 'users',
            // @ts-ignore
            data: {
              ...userData,
              password: userData.email as string, // Default password only for new users
            }
          })
        }

        successCount++
        if (existingUser.docs.length > 0) {
          updatedCount++
          console.log(`✓ Updated user ${userProfile.UserName} (${userProfile.UserId}) with ${companies.length} firms`)
        } else {
          createdCount++
          console.log(`✓ Created user ${userProfile.UserName} (${userProfile.UserId}) with ${companies.length} firms`)
        }
      } catch (error) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'user',
          typeId: userProfile.UserId.toString(),//@ts-ignore
          comments: `Failed to migrate user: ${error.message}`,
          row: JSON.stringify({
            userData,
          }, null, 2)
        })
        console.error(`✗ Failed to migrate user ${userProfile.UserName} (${userProfile.UserId}):`, error)
      }
    }

    // Print migration summary
    console.log('\nMigration Summary:')
    console.log(`✓ Successfully processed users: ${successCount}`)
    console.log(`  - Created: ${createdCount}`)
    console.log(`  - Updated: ${updatedCount}`)
    console.log(`✗ Failed migrations: ${errorCount}`)
    console.log(`Total processed: ${successCount + errorCount}`)
    if (errorCount > 0) {
      console.log('\nCheck migration-faults collection for detailed error information.')
    }
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
}
