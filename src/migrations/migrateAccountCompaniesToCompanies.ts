import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { Company } from '@/payload-types'

/**
 * Migration to convert accounts to companies:
 * 1. Iterate all Companies with mainAccount or subAccounts
 * 2. For each company:
 *    - If accounts share the same name, rename them by adding an index
 *    - For each account (mainAccount and subAccounts), create a new company with the account name
 *    - Make the current company the parent of the new companies
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting AccountCompaniesToCompanies migration process...')

  try {
    // Find all companies with mainAccount or subAccounts
    const companiesResult = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0
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
          accountNumber: string;
          name: string;
          subAccounts: string[]
        };

        const accountInfos: AccountInfo[] = [];

        // Process mainAccount array if it exists
        if (company.mainAccount && Array.isArray(company.mainAccount)) {
          for (const mainAcc of company.mainAccount) {
            if (mainAcc.accountNumber) {
              // Add main account to accountInfos
              accountInfos.push({
                accountNumber: mainAcc.accountNumber,
                name: mainAcc.accountName || `Account ${mainAcc.accountNumber}` ,// Use accountName if available, otherwise use default
                subAccounts: mainAcc.subAccounts || []
              });
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
          console.log(`Found ${duplicateAccounts.length + 1} accounts with name "${name}" - renaming`)
          // Start index from 1
          let index = 1
          for (const accountInfo of duplicateAccounts) {
            accountInfo.name = `${name} ${index}`
            console.log(`Renaming account to: ${accountInfo.name}`)
            index++
          }
        }


        const childIds:string[]=[]
        // Process each account to create a new company
        for (const accountInfo of accountInfos) {
          try {
            console.log(`Processing account: ${accountInfo.name} (Account Number: ${accountInfo.accountNumber})`)

            // Create a new company with the account name
            const newCompanyData: Partial<Company> = {
              legacyCompanyId: company.companyId,
              name: accountInfo.name,
              active: true,
              // Set the account number in the appropriate field using the new structure
              mainAccount: [
                {
                  accountNumber: accountInfo.accountNumber,
                  accountName: accountInfo.name,
                  subAccounts: accountInfo.subAccounts
                }
              ]
            }

            const newCompany = await payload.create({
              collection: 'companies',
              data: newCompanyData as Company,
            })

            console.log(`Created new company: ${newCompany.name} (ID: ${newCompany.id})`)
            childIds.push(newCompany.id)
            processedAccounts++
          } catch (error) {
            console.error(`Error processing account ${accountInfo.name} (Account Number: ${accountInfo.accountNumber}):`, error)
            errorCount++
          }
        }
        // Update the account to link to the new company
        await payload.update({
          collection: 'companies',
          id: company.id,
          data: {
            subCompanies: childIds,
            mainAccount:[]
          },
        })
        processedCompanies++
      } catch (error) {
        console.error(`Error processing company ${company.name} (ID: ${company.id}):`, error)
        errorCount++
      }
    }

    console.log(`
Migration completed:
- Processed companies: ${processedCompanies}
- Processed accounts: ${processedAccounts}
- Errors: ${errorCount}
    `)

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
  console.log('Down migration not implemented for AccountCompaniesToCompanies')
}
