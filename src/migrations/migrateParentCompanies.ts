import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import path from 'path'
import fs from 'fs'

// Define interfaces for our company data
interface CompanyNode {
  id: string
  name: string
  level: 1 | 2 | 3
  companyId?: number
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
      const createData: any = {
        name: company.name,
        active: true,
      }

      // Set companyId if provided
      if (company.companyId) {
        createData.companyId = company.companyId
      }

      // Set parent company if provided
      if (parentId) {
        createData.parentCompany = parentId
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
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting Parent Companies migration...')

    // Process the JSON file and create companies
    await processJsonFile(payload)

    console.log('Parent Companies migration completed')
  } catch (error) {
    console.error('Error during Parent Companies migration:', error)
    throw error
  }
}

export async function down({ payload }: MigrateUpArgs): Promise<void> {
  // Implement the down migration if needed
}
