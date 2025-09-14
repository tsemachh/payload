import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import path from 'path'
import fs from 'fs'
import { Company } from '@/payload-types'
import { createMSSqlPool } from '@/migrations/utils/utils'
import { getCompanyIdToChildCompanies, getCompanyIdToSequenceMap } from '@/utils/utils'
import { createErrorFaultComment, logMigrationFault } from '@/migrations/utils/migrationFaultUtils'

/**
 * Migrates firms and related data in the following order:
 * 1. migrateFirms - Migrates basic firm data
 * 2. migrateAccounts - Migrates account data
 * 3. migrateSubAccounts - Migrates sub-account data
 * 4. migrateParentCompanies - Migrates parent company relationships
 * 5. migrateAccountCompaniesToCompanies - Converts accounts to companies
 *
 * This combined migration ensures that companies are not created if they already exist
 * by including checks in each step of the migration process.
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting migrateFullFirms process...')

  try {
    // 1. Migrate Firms
    await migrateFirms({ payload, req })

    // 2. Migrate Accounts
    await migrateAccounts({ payload, req })

    // 3. Migrate Sub Accounts
    await migrateSubAccounts({ payload, req })

    // 4. Migrate Parent Companies
    await migrateParentCompanies({ payload, req })

    // 5. Migrate Account Companies To Companies
    await migrateAccountCompaniesToCompanies({ payload, req })

    // Now run the silenced stocks companies migration
    console.log('\n=== Starting Silenced Stocks Companies Migration ===')
    await migrateSilencedStocksCompanies(payload, req)
    console.log('=== Silenced Stocks Companies Migration Completed ===\n')
    console.log('migrateFullFirms process completed successfully!')
  } catch (error) {
    console.error('Error during migrateFullFirms process:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
  console.log('Down migration not implemented for migrateFullFirms')
}

// ==================== 1. MIGRATE FIRMS ====================

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

async function migrateFirms({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    const pool = await createMSSqlPool()

    // Get firms data from SQL Server
    const resultFirms = await getFirms(pool)
    console.log(`Retrieved ${resultFirms.recordset.length} firms from SQL Server`)
    // Transform and insert data into Payload CMS
    let successCount = 0
    let errorCount = 0

    for (const row of resultFirms.recordset) {
      try {
        // Transform the data to match Payload CMS format
        const companyData: Partial<Company> = {
          companyId: row.firmId,
          name: row.name,
          order: row.order,
          type: 'regular',
          active: !!row.active,
          researchDocuments: {
            showResearch: !!row.showResearch,
            showResearchBond: !!row.showResearchBond,
            showResearchTrusteeship: !!row.showResearchTrusteeship,
          },
        }

        // Check if firm already exists
        const existingCompany = await payload.find({
          collection: 'companies',
          where: {
            companyId: {
              equals: row.firmId,
            },
          },
          limit: 1,
        })

        if (existingCompany.docs.length > 0) {
          // Update existing firm
          await payload.update({
            collection: 'companies',
            id: existingCompany.docs[0].id,
            data: companyData,
            req: {
              ...req,
              context: { ...req.context, from: 'migration' },
            },
          })
        } else {
          // Create new firm
          await payload.create({
            collection: 'companies',
            data: companyData as Company,
            req: {
              ...req,
              context: { ...req.context, from: 'migration' },
            },
          })
        }

        successCount++
        console.log(
          `✓ Processed firm: ${row.firmId} (${successCount}/${resultFirms.recordset.length})`,
        )
      } catch (error) {
        errorCount++
        console.error(`✗ Error processing firm ${row.firmId}:`, error)
      }
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
    console.log('=== Firms Migration Completed ===\n')
  } catch (error) {
    console.error('Critical error during firms migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  } finally {
  }
}

// ==================== 2. MIGRATE ACCOUNTS ====================

interface AccountRow {
  accountNumber: number
  name: string
  firmId: number
}

async function getAccounts(pool: sql.ConnectionPool): Promise<sql.IResult<AccountRow>> {
  const result = await pool.request().query(`
      SELECT [firmID]      as firmId,
             [accountNum]  as accountNumber,
             [accountName] as name
      FROM [dbEmda].[dbo].[clientsubaccounts]
      ORDER BY [firmID], [accountNum]
  `)
  return result
}

async function migrateAccounts({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('\n=== Starting Accounts Migration ===')
    pool = await createMSSqlPool()

    // Get accounts data from SQL Server
    const resultAccounts = await getAccounts(pool)

    console.log(`Retrieved ${resultAccounts.recordset.length} accounts from SQL Server`)

    let successCount = 0
    let errorCount = 0

    // Group accounts by firmId
    const accountsByFirmId = new Map<number, AccountRow[]>()

    for (const row of resultAccounts.recordset) {
      if (!accountsByFirmId.has(row.firmId)) {
        accountsByFirmId.set(row.firmId, [])
      }
      accountsByFirmId.get(row.firmId)?.push(row)
    }

    console.log(`Grouped accounts into ${accountsByFirmId.size} firms`)

    // Process each firm once
    for (const [firmId, accounts] of accountsByFirmId.entries()) {
      try {
        // Find the firm
        const companyResult = await payload.find({
          collection: 'companies',
          where: {
            companyId: {
              equals: firmId,
            },
          },
          limit: 1,
        })

        if (companyResult.docs.length === 0) {
          console.error(`No firm found for firmId: ${firmId}`)
          // Report to migration faults for all accounts of this firm
          for (const account of accounts) {
            await payload.create({
              collection: 'migration-faults',
              data: {
                type: 'account',
                comments: `No firm found for firmId: ${firmId}`,
                row: JSON.stringify(account),
                typeId: `${account.accountNumber}`,
              },
              req: {
                ...req,
                context: { ...req.context, from: 'migration' },
              },
            })
            errorCount++
          }
          continue
        }

        const theCompany: Company = companyResult.docs[0]
        const companyId = theCompany.id

        // Get existing mainAccount array or initialize empty array
        const mainAccount = theCompany.mainAccount || []

        // Add all accounts for this firm
        for (const account of accounts) {
          mainAccount.push({
            accountNumber: account.accountNumber.toString(),
            accountName: account.name || `Account ${account.accountNumber}`,
          })
          successCount++
        }

        // Update company with all mainAccount entries at once
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            mainAccount,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration' },
          },
        })

        console.log(`Updated company ${companyId} with ${accounts.length} mainAccount entries`)
      } catch (error) {
        console.error(`Error processing accounts for firm ${firmId}:`, error)
        errorCount += accounts.length
      }
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
    console.log('=== Accounts Migration Completed ===\n')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
      console.log('SQL connection closed')
    }
  }
}

// ==================== 3. MIGRATE SUB ACCOUNTS ====================

interface SubAccountRow {
  firmId: number
  accountIdOld: number
  accountIdNew: number
}

async function getHoldingsTables(pool: sql.ConnectionPool): Promise<string[]> {
  const result = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE 'Holdings%accounts'
  `)
  return result.recordset.map((row) => row.TABLE_NAME)
}

async function getSubAccounts(
  pool: sql.ConnectionPool,
  tableName: string,
): Promise<sql.IResult<SubAccountRow>> {
  const result = await pool.request().query(`
    SELECT 
      [firm_id] as firmId,
      [account_id_old] as accountIdOld,
      [account_id_new] as accountIdNew
    FROM [dbEmda].[dbo].[${tableName}]
  `)
  return result
}

async function migrateSubAccounts({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('\n=== Starting Sub Accounts Migration ===')
    pool = await createMSSqlPool()

    // Get all Holdings tables
    const holdingsTables = await getHoldingsTables(pool)

    console.log(`Found ${holdingsTables.length} Holdings tables`)

    let successCount = 0
    let errorCount = 0

    // Process each Holdings table
    for (const tableName of holdingsTables) {
      console.log(`Processing table: ${tableName}`)
      const subAccounts = await getSubAccounts(pool, tableName)

      // Group sub-accounts by firmId
      const subAccountsByFirmId = new Map<number, SubAccountRow[]>()

      for (const row of subAccounts.recordset) {
        if (row.accountIdNew == row.accountIdOld) {
          payload.create({
            collection: 'migration-faults',
            data: {
              type: 'account',
              comments: `duplicate accountNumber`,
              row: JSON.stringify(row),
            },
          })
          continue
        }

        if (!subAccountsByFirmId.has(row.firmId)) {
          subAccountsByFirmId.set(row.firmId, [])
        }
        subAccountsByFirmId.get(row.firmId)?.push(row)
      }

      console.log(`Grouped sub-accounts into ${subAccountsByFirmId.size} firms`)

      // Process firms in batches with a promise pool
      const processFirm = async (
        firmId: number,
        firmSubAccounts: SubAccountRow[],
      ): Promise<void> => {
        try {
          // Find the firm
          const companyResult = await payload.find({
            collection: 'companies',
            where: {
              companyId: {
                equals: firmId,
              },
            },
            limit: 1,
            depth: 0,
          })

          if (companyResult.docs.length === 0) {
            // Report to migration faults for all sub-accounts of this firm
            for (const subAccount of firmSubAccounts) {
              await payload.create({
                collection: 'migration-faults',
                data: {
                  type: 'account',
                  comments: `No firm found for firmId: ${firmId}`,
                  row: JSON.stringify(subAccount),
                },
              })
              errorCount++
            }
            return
          }

          // Get the company to check for existing mainAccount
          const company: Company = companyResult.docs[0]
          const companyId = company.id

          // Get the mainAccount array
          const mainAccount = company.mainAccount || []
          let updated = false

          // Process all sub-accounts for this firm
          for (const row of firmSubAccounts) {
            try {
              // Find the mainAccount entry for the parent account
              let mainAccountEntry = mainAccount.find(
                (ma: any) => ma.accountNumber === row.accountIdNew.toString(),
              )

              // If no mainAccount entry exists for the parent account, create one
              if (!mainAccountEntry) {
                mainAccountEntry = {
                  accountNumber: row.accountIdNew.toString(),
                  accountName: `Account ${row.accountIdNew}`,
                  subAccounts: [],
                }
                mainAccount.push(mainAccountEntry)
                updated = true
              }

              // Ensure subAccounts array exists
              if (!mainAccountEntry.subAccounts) {
                mainAccountEntry.subAccounts = []
                updated = true
              }

              // Check if this subaccount already exists in the array
              const subAccountExists = mainAccountEntry.subAccounts.includes(
                row.accountIdOld.toString(),
              )

              if (!subAccountExists) {
                // Add new subaccount
                mainAccountEntry.subAccounts.push(row.accountIdOld.toString())
                updated = true
                console.log(
                  `Added subaccount ${row.accountIdOld} to mainAccount ${row.accountIdNew} for company ${companyId}`,
                )
              }

              successCount++
            } catch (error) {
              console.error(
                `Error processing sub-account ${row.accountIdOld} for firm ${firmId}:`,
                error,
              )
              errorCount++
            }
          }

          // Update company with new mainAccount array only once per firm
          if (updated) {
            await payload.update({
              collection: 'companies',
              id: companyId,
              data: {
                mainAccount,
              },
            })
            console.log(`Updated company ${companyId} with all sub-accounts`)
          }
        } catch (error) {
          console.error(`Error processing firm ${firmId}:`, error)
          errorCount += firmSubAccounts.length
        }
      }

      // Create an array of firms to process
      const firms = Array.from(subAccountsByFirmId.entries())
      const totalFirms = firms.length

      // Set up promise pool with size 20
      const POOL_SIZE = 20

      // Process firms in batches
      for (let i = 0; i < totalFirms; i += POOL_SIZE) {
        console.log(
          `Processing batch ${Math.floor(i / POOL_SIZE) + 1}/${Math.ceil(totalFirms / POOL_SIZE)}`,
        )

        const batch = []

        // Create a batch of promises up to POOL_SIZE
        for (let j = 0; j < POOL_SIZE && i + j < totalFirms; j++) {
          const [firmId, firmSubAccounts] = firms[i + j]
          batch.push(processFirm(firmId, firmSubAccounts))
        }

        // Wait for all promises in the current batch to complete
        await Promise.all(batch)
      }
    }

    console.log(`Migration completed. Success: ${successCount}, Errors: ${errorCount}`)
    console.log('=== Sub Accounts Migration Completed ===\n')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    if (pool) {
      await pool.close()
      console.log('SQL connection closed')
    }
  }
}

// ==================== 4. MIGRATE PARENT COMPANIES ====================

// Define interfaces for our company data
interface CompanyNode {
  id: string
  name: string
  level: 1 | 2 | 3
  companyId?: number
  privateRegistrationNumbers?: number[]
  children?: CompanyNode[]
}

interface HierarchicalData {
  companies: CompanyNode[]
}

// Function to process JSON file
async function processJsonFile(payload: any): Promise<void> {
  try {
    console.log('Starting to process JSON file...')

    // Get the path to the JSON file
    const jsonPath = path.join(process.cwd(), 'src/migrations/parentCompanies.hierarchical.json')
    console.log(`Looking for JSON file at: ${jsonPath}`)

    // Check if the file exists
    if (!fs.existsSync(jsonPath)) {
      console.error(`File not found: ${jsonPath}`)
      throw new Error('JSON file not found')
    }

    console.log('File found! Attempting to read...')

    // Read the JSON file
    const jsonData = fs.readFileSync(jsonPath, 'utf8')
    const hierarchicalData: HierarchicalData = JSON.parse(jsonData)

    console.log(`Found ${hierarchicalData.companies.length} level 1 companies in the JSON file`)

    // Process the companies
    await processCompanies(payload, hierarchicalData.companies)
  } catch (error) {
    console.error('Error processing JSON file:', error)
    throw error
  }
}

// Function to process companies from the hierarchical JSON
async function processCompanies(payload: any, companies: CompanyNode[]): Promise<void> {
  console.log('Processing companies from hierarchical JSON...')

  // Process each level 1 company
  for (const company of companies) {
    await processCompany(payload, company, null)
  }
}

// Function to process a single company and its children
async function processCompany(
  payload: any,
  company: CompanyNode,
  parentId: string | null,
): Promise<string> {
  try {
    console.log(`Processing company: ${company.name} (level: ${company.level})`)

    // Check if company already exists by companyId (if available)
    let existingCompany = null
    if (company.companyId) {
      existingCompany = await payload.find({
        collection: 'companies',
        where: {
          companyId: {
            equals: company.companyId,
          },
        },
        limit: 1,
      })

      if (existingCompany.docs.length > 0) {
        console.log(
          `Found existing company by companyId: ${company.name} (companyId: ${company.companyId})`,
        )
      }
    }

    // If not found by companyId, check by name
    if (!existingCompany || existingCompany.docs.length === 0) {
      existingCompany = await payload.find({
        collection: 'companies',
        where: {
          name: {
            equals: company.name,
          },
        },
        limit: 1,
      })

      if (existingCompany.docs.length > 0) {
        console.log(`Found existing company by name: ${company.name}`)
      }
    }

    let companyId: string

    if (existingCompany && existingCompany.docs.length > 0) {
      // Update existing company
      companyId = existingCompany.docs[0].id

      // Prepare update data
      const updateData: any = {
        name: company.name,
        active: true,
      }

      // Only set companyId if it's provided and different from existing
      if (company.companyId && existingCompany.docs[0].companyId !== company.companyId) {
        updateData.companyId = company.companyId
      }

      // Set privateRegistrationNumber if provided
      if (company.privateRegistrationNumbers && company.privateRegistrationNumbers.length > 0) {
        updateData.privateRegistrationNumber = company.privateRegistrationNumbers
      }

      // Set parent company if provided and different from existing
      if (parentId && existingCompany.docs[0].parentCompany !== parentId) {
        updateData.parentCompany = parentId
      }

      await payload.update({
        collection: 'companies',
        id: companyId,
        data: updateData,
      })

      console.log(`Updated company: ${company.name}`)
    } else {
      // Create new company
      const createData: Partial<Company> = {
        name: company.name,
        active: true,
        type: 'parent',
      }

      // Set companyId if provided
      if (company.companyId) {
        createData.companyId = company.companyId
      }

      // Set privateRegistrationNumber if provided
      if (company.privateRegistrationNumbers && company.privateRegistrationNumbers.length > 0) {
        createData.privateRegistrationNumber = company.privateRegistrationNumbers
      }

      const result = await payload.create({
        collection: 'companies',
        data: createData,
      })

      companyId = result.id
      console.log(`Created new company: ${company.name}`)
    }

    // Process children if any
    if (company.children && company.children.length > 0) {
      console.log(`Processing ${company.children.length} children of ${company.name}...`)

      const childIds: string[] = []

      for (const child of company.children) {
        const childId = await processCompany(payload, child, companyId)
        childIds.push(childId)
      }

      // Update parent company's subCompanies field
      const parentCompany = await payload.findByID({
        collection: 'companies',
        id: companyId,
      })

      // Get existing subCompanies
      const existingSubCompanies = parentCompany.subCompanies || []

      // Add new children that don't already exist
      const newSubCompanies = [...existingSubCompanies]
      for (const childId of childIds) {
        if (!newSubCompanies.includes(childId)) {
          newSubCompanies.push(childId)
        }
      }

      // Only update if there are changes
      if (newSubCompanies.length !== existingSubCompanies.length) {
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            type: 'parent',
            subCompanies: newSubCompanies,
          },
        })

        console.log(`Updated subCompanies for ${company.name}`)
      }
    }

    return companyId
  } catch (error) {
    console.error(`Error processing company ${company.name}:`, error)
    throw error
  }
}

async function migrateParentCompanies({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('\n=== Starting Parent Companies Migration ===')

    // Process the JSON file and create companies
    await processJsonFile(payload)

    console.log('=== Parent Companies Migration Completed ===\n')
  } catch (error) {
    console.error('Error during Parent Companies migration:', error)
    throw error
  }
}

// ==================== 5. MIGRATE ACCOUNT COMPANIES TO COMPANIES ====================

/**
 * Migration to convert accounts to companies:
 * 1. Iterate all Companies with mainAccount or subAccounts
 * 2. For each company:
 *    - If accounts share the same name, rename them by adding an index
 *    - For each account (mainAccount and subAccounts), create a new company with the account name
 *    - Make the current company the parent of the new companies
 */
async function migrateAccountCompaniesToCompanies({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('\n=== Starting Account Companies To Companies Migration ===')

  try {
    // Find all companies with mainAccount or subAccounts
    const companiesResult = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      where: {
        and: [
          {
            type: {
              equals: 'regular',
            },
          },
          {
            mainAccount: {
              exists: true,
            },
          },
        ],
      },
    })

    console.log(`Found ${companiesResult.docs.length} companies with accounts`)

    let processedCompanies = 0
    let processedAccounts = 0
    let errorCount = 0

    // Process each company
    for (const company of companiesResult.docs) {
      try {
        console.log(`Processing company: ${company.name} (ID: ${company.id})`)

        // Collect account information from mainAccount and subAccounts
        type AccountInfo = {
          accountNumber: string
          name: string
          subAccounts: string[]
        }

        const accountInfos: AccountInfo[] = []

        // Process mainAccount array if it exists
        if (company.mainAccount && Array.isArray(company.mainAccount)) {
          for (const mainAcc of company.mainAccount) {
            if (mainAcc.accountNumber) {
              // Add main account to accountInfos
              accountInfos.push({
                accountNumber: mainAcc.accountNumber,
                name: mainAcc.accountName || `Account ${mainAcc.accountNumber}`, // Use accountName if available, otherwise use default
                subAccounts: mainAcc.subAccounts || [],
              })
            }
          }
        }

        // Skip if company has no accounts or only one account
        if (accountInfos.length <= 0) {
          console.log(`Company ${company.name} has no accounts , skipping`)
          continue
        }

        console.log(`Found ${accountInfos.length} accounts for company ${company.name}`)

        // Check for duplicate account names and rename if needed
        const accountNameCounts: Record<string, number> = {}
        const accountsToRename: Record<string, AccountInfo[]> = {}
        const firstAccountWithName: Record<string, AccountInfo> = {}

        // Count occurrences of each account name
        for (const accountInfo of accountInfos) {
          const name = accountInfo.name

          if (accountNameCounts[name] === undefined) {
            // First occurrence of this name
            accountNameCounts[name] = 1
            firstAccountWithName[name] = accountInfo
          } else {
            // Second or later occurrence
            accountNameCounts[name] += 1

            // If this is the second occurrence, add the first account to the rename list
            if (accountNameCounts[name] === 2) {
              if (!accountsToRename[name]) {
                accountsToRename[name] = []
              }
              accountsToRename[name].push(firstAccountWithName[name])
            }

            // Add this account to the rename list
            if (!accountsToRename[name]) {
              accountsToRename[name] = []
            }
            accountsToRename[name].push(accountInfo)
          }
        }

        // Rename accounts with duplicate names
        for (const [name, duplicateAccounts] of Object.entries(accountsToRename)) {
          console.log(
            `Found ${duplicateAccounts.length + 1} accounts with name "${name}" - renaming`,
          )
          // Start index from 1
          let index = 1
          for (const accountInfo of duplicateAccounts) {
            accountInfo.name = `${name} ${index}`
            console.log(`Renaming account to: ${accountInfo.name}`)
            index++
          }
        }

        const childIds: string[] = []
        // Process each account to create a new company
        for (const accountInfo of accountInfos) {
          try {
            console.log(
              `Processing account: ${accountInfo.name} (Account Number: ${accountInfo.accountNumber})`,
            )

            // Check if company already exists with the same name or account number
            const companyName = `${accountInfo.name} - ${accountInfo.accountNumber}`
            const existingCompanyResult = await payload.find({
              collection: 'companies',
              where: {
                or: [
                  {
                    name: {
                      equals: companyName,
                    },
                  },
                  {
                    and: [
                      {
                        'mainAccount.accountNumber': {
                          equals: accountInfo.accountNumber,
                        },
                      },
                      {
                        legacyCompanyId: {
                          equals: company.companyId,
                        },
                      },
                    ],
                  },
                ],
              },
              limit: 1,
            })

            let newCompany

            // Create a new company with the account name
            const newCompanyData: Partial<Company> = {
              legacyCompanyId: company.companyId,
              name: companyName,
              active: company.active,
              type: 'fund',
              // Set the account number in the appropriate field using the new structure
              mainAccount: [
                {
                  accountNumber: accountInfo.accountNumber,
                  accountName: accountInfo.name,
                  subAccounts: accountInfo.subAccounts,
                },
              ],
            }

            if (existingCompanyResult.docs.length > 0) {
              // Update existing company
              console.log(`Company already exists: ${companyName}, updating instead of creating`)
              newCompany = await payload.update({
                collection: 'companies',
                id: existingCompanyResult.docs[0].id,
                data: newCompanyData,
              })
            } else {
              // Create new company
              newCompany = await payload.create({
                collection: 'companies',
                data: newCompanyData as Company,
              })
            }

            if (existingCompanyResult.docs.length > 0) {
              console.log(`Updated existing company: ${newCompany.name} (ID: ${newCompany.id})`)
            } else {
              console.log(`Created new company: ${newCompany.name} (ID: ${newCompany.id})`)
            }
            childIds.push(newCompany.id)
            processedAccounts++
          } catch (error) {
            console.error(
              `Error processing account ${accountInfo.name} (Account Number: ${accountInfo.accountNumber}):`,
              error,
            )
            errorCount++
          }
        }
        // Update the account to link to the new company and clear all account-related fields
        try {
          const updateResult = await payload.update({
            collection: 'companies',
            id: company.id,
            data: {
              subCompanies: childIds,
              mainAccount: [], // Clear the mainAccount array
            },
          })

          // Verify that the mainAccount array was cleared
          if (updateResult.mainAccount && updateResult.mainAccount.length > 0) {
            console.error(
              `Warning: mainAccount array not cleared for company ${company.name} (ID: ${company.id})`,
            )

            // Try again with a direct update
            await payload.update({
              collection: 'companies',
              id: company.id,
              data: {
                mainAccount: [],
              },
            })

            console.log(
              `Attempted second update to clear mainAccount for company ${company.name} (ID: ${company.id})`,
            )
          } else {
            console.log(
              `Successfully cleared mainAccount for company ${company.name} (ID: ${company.id})`,
            )
          }
        } catch (error) {
          console.error(`Error updating company ${company.name} (ID: ${company.id}):`, error)
          errorCount++
        }
        processedCompanies++
      } catch (error) {
        console.error(`Error processing company ${company.name} (ID: ${company.id}):`, error)
        errorCount++
      }
    }

    // Final check to find any companies that still have accounts
    const companiesWithAccountsResult = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      where: {
        and: [
          {
            type: {
              equals: 'regular',
            },
          },
          {
            mainAccount: {
              exists: true,
            },
          },
          {
            mainAccount: {
              not_equals: [],
            },
          },
        ],
      },
    })

    if (companiesWithAccountsResult.docs.length > 0) {
      console.log(
        `Warning: Found ${companiesWithAccountsResult.docs.length} companies that still have accounts after migration`,
      )

      // Process each company that still has accounts
      for (const company of companiesWithAccountsResult.docs) {
        console.log(
          `Company ${company.name} (ID: ${company.id}) still has ${company?.mainAccount?.length} accounts`,
        )

        // Try to clear the mainAccount array again
        try {
          await payload.update({
            collection: 'companies',
            id: company.id,
            data: {
              mainAccount: [],
            },
          })
          console.log(`Cleared mainAccount for company ${company.name} (ID: ${company.id})`)
        } catch (error) {
          console.error(
            `Error clearing mainAccount for company ${company.name} (ID: ${company.id}):`,
            error,
          )
        }
      }
    } else {
      console.log('No companies found with accounts after migration')
    }

    console.log(`
Migration completed:
- Processed companies: ${processedCompanies}
- Processed accounts: ${processedAccounts}
- Errors: ${errorCount}
- Companies still with accounts: ${companiesWithAccountsResult.docs.length}
    `)
    console.log('=== Account Companies To Companies Migration Completed ===\n')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Minimum date for holdings (January 1, 2024)
const MIN_HOLDINGS_DATE = '2024-01-01'

interface StockFirmRow {
  stockNum: string
  firm: string
}

async function getDistinctStockFirms(pool: sql.ConnectionPool): Promise<sql.IResult<StockFirmRow>> {
  const request = pool.request()
  request.input('minDate', sql.VarChar, MIN_HOLDINGS_DATE)
  return await request.query(`
      SELECT distinct [stockNum]
                    , [firm]
      FROM [dbEmda].[dbo].[holdings]
      WHERE [date1] >= @minDate
  `)
}

// Function to migrate silenced stocks companies
export async function migrateSilencedStocksCompanies(payload: any, req: any): Promise<void> {
  try {
    const pool = await createMSSqlPool()

    console.log('Starting silenced stocks companies migration process...')

    // Initialize counters
    let successCount = 0
    let errorCount = 0

    // Preload company mappings
    console.log('Preloading company mappings...')
    const companyIdToSequence = await getCompanyIdToSequenceMap(payload)
    const companyIdToChildCompanies = await getCompanyIdToChildCompanies(payload)
    console.log(`Preloaded ${companyIdToSequence.size} companies`)
    console.log(`Preloaded ${companyIdToChildCompanies.size} companies with child companies`)

    // Get distinct stockNum and firm from holdings table
    console.log('Fetching distinct stock numbers and firms from holdings...')
    const stockFirmsResult = await getDistinctStockFirms(pool)
    console.log(
      `Found ${stockFirmsResult.recordset.length} distinct stock-firm pairs from ${MIN_HOLDINGS_DATE}`,
    )

    // Create a map of company ID to silenced stocks
    const companyToStocks = new Map<string, Set<string>>()

    // Create a map of stockNum to firms from holdings
    const stockToFirms = new Map<string, Set<string>>()
    for (const row of stockFirmsResult.recordset) {
      if (!stockToFirms.has(`${row.stockNum}`)) {
        stockToFirms.set(`${row.stockNum}`, new Set<string>())
      }
      stockToFirms.get(`${row.stockNum}`)?.add(`${row.firm}`)
    }

    // Read all entries from SilencedStocks collection
    console.log('Fetching all silenced stocks...')
    const silencedStocks = await payload.find({
      collection: 'silenced-stocks',
      limit: 0,
      req,
    })
    console.log(`Found ${silencedStocks.docs.length} silenced stocks`)

    // For each silenced stock, find the firm IDs pointing to it and add to company-to-stocks map
    for (const silencedStock of silencedStocks.docs) {
      const stockId = silencedStock.stockId
      if (!stockId) {
        console.warn(`Silenced stock with ID ${silencedStock.id} has no stockId, skipping`)
        continue
      }

      // Get firms for this stock
      const firms = stockToFirms.get(stockId)
      if (!firms || firms.size === 0) {
        console.log(`No firms found for silenced stock ${stockId}, skipping`)
        continue
      }

      // Convert firms to company IDs and add stock to each company
      for (const firm of firms) {
        const companyId = companyIdToSequence.get(firm)
        if (companyId) {
          // Add stock to company
          if (!companyToStocks.has(companyId)) {
            companyToStocks.set(companyId, new Set<string>())
          }
          companyToStocks.get(companyId)?.add(stockId)

          /*          // Also add to child companies
          const companyChildIds = companyIdToChildCompanies.get(firm)
          if (companyChildIds && companyChildIds.length > 0) {
            for (const childId of companyChildIds) {
              if (!companyToStocks.has(childId)) {
                companyToStocks.set(childId, new Set<string>())
              }
              companyToStocks.get(childId)?.add(stockId)
            }
          }*/
        } else {
          console.warn(`Company ID not found for firm: ${firm}`)
        }
      }
    }

    // Update each company with its silenced stocks
    const companyIds = Array.from(companyToStocks.keys())
    console.log(`Updating ${companyIds.length} companies with silenced stocks...`)

    for (const companyId of companyIds) {
      try {
        const silencedStockIds = Array.from(companyToStocks.get(companyId) || [])

        if (silencedStockIds.length === 0) {
          console.log(`No silenced stocks for company ${companyId}, skipping`)
          continue
        }

        // Update the company with its silenced stocks
        await payload.update({
          collection: 'companies',
          id: companyId,
          data: {
            silencedStocks: silencedStockIds,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration' },
          },
        })

        successCount++
        console.log(
          `✓ Updated company ${companyId} with ${silencedStockIds.length} silenced stocks (${successCount}/${companyIds.length})`,
        )
      } catch (error) {
        errorCount++
        console.error(`Error updating company ${companyId}:`, error)
        await logMigrationFault({
          payload,
          type: 'company',
          row: JSON.stringify({ companyId }),
          typeId: companyId,
          comments: createErrorFaultComment({
            id: companyId,
            operation: 'Update company silenced stocks',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
      }
    }

    console.log('\nSilenced Stocks Migration Summary:')
    console.log(`Total companies processed: ${companyIds.length}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    console.log('Silenced stocks migration completed successfully.')
  } catch (error) {
    console.error('Critical error during silenced stocks migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  }
}
