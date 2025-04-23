import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { Account, Company } from '@/payload-types'

/**
 * Migration to convert accounts to companies:
 * 1. Iterate all Companies with number of accounts >= 1
 * 2. For each company:
 *    - If accounts share the same name, rename them by adding an index
 *    - For each account, create a new company with the account name
 *    - Link the account to the new company instead of the current one
 *    - Make the current company the parent of the new company
 */
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  console.log('Starting AccountCompaniesToCompanies migration process...')

  try {
    // Find all companies with at least one account
    const companiesResult = await payload.find({
      collection: 'companies',
      depth: 1, // We need to fetch the accounts
      limit: 500,
    })

    console.log(`Found ${companiesResult.docs.length} companies with accounts`)

    let processedCompanies = 0
    let processedAccounts = 0
    let errorCount = 0

    // Process each company
    for (const company of companiesResult.docs) {
      try {
        console.log(`Processing company: ${company.name} (ID: ${company.id})`)
        const accounts = company.accounts?.docs as Account[]
        // Skip if company has no accounts
        if (!accounts || accounts.length == 1) {
          console.log(`Company ${company.name} has no accounts or 1 account, skipping`)
          continue
        }

        console.log(`Found ${accounts.length} accounts for company ${company.name}`)

        // Check for duplicate account names and rename if needed
        const accountNameCounts: Record<string, number> = {}
        const accountsToRename: Record<string, Account[]> = {}
        const firstAccountWithName: Record<string, Account> = {}

        // Count occurrences of each account name
        for (const account of accounts) {
          const name = account.name

          if (accountNameCounts[name] === undefined) {
            // First occurrence of this name
            accountNameCounts[name] = 1
            firstAccountWithName[name] = account
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
            accountsToRename[name].push(account)
          }
        }

        // Rename accounts with duplicate names
        for (const [name, duplicateAccounts] of Object.entries(accountsToRename)) {
          console.log(`Found ${duplicateAccounts.length + 1} accounts with name "${name}" - renaming`)
          // Start index from 1
          let index = 1
          for (const account of duplicateAccounts) {
            account.name = `${name} ${index}`
            console.error("******************Renaming:",account.name)
            index++
          }
        }


        const childIds:string[]=[]
        // Process each account to create a new company
        for (const account of accounts) {
          try {
            console.log(`Processing account: ${account.name} (ID: ${account.id})`)

            // Create a new company with the account name
            const newCompanyData: Partial<Company> = {
              legacyCompanyId:company.companyId,
              name: account.name,
              active: true,
            }

            const newCompany = await payload.create({
              collection: 'companies',
              data: newCompanyData as Company,
            })

            console.log(`Created new company: ${newCompany.name} (ID: ${newCompany.id})`)

            // Update the account to link to the new company
            await payload.update({
              collection: 'accounts',
              id: account.id,
              data: {
                name: account.name,
                company: newCompany.id, // Link account to new company
              },
            })
            childIds.push(newCompany.id)
            console.log(`Updated account ${account.name} to link to new company ${newCompany.name}`)
            processedAccounts++
          } catch (error) {
            console.error(`Error processing account ${account.name} (ID: ${account.id}):`, error)
            errorCount++
          }
        }
        // Update the account to link to the new company
        await payload.update({
          collection: 'companies',
          id: company.id,
          data: {
            subCompanies: childIds,
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
