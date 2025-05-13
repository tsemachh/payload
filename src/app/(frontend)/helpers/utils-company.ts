import { getPayload } from 'payload'
import config from '@/payload.config'
import { TreeNode as BaseTreeNode } from '../holdings/components/CompanySelector'

// Define account interface
export interface Account {
  accountNumber: string
  accountName?: string
  subAccounts?: string[]
}

// Define company interface
export interface Company {
  id: string
  name: string
  companyId?: number
  active?: boolean
  subCompanies?: Array<Company | string>
  parentCompany?: {
    docs?: Company[]
  } | Company[] | Company
  mainAccount?: Account[]
}

// Define company data interface
export interface CompanyData {
  company: Company
  companyId?: number
}

// Extended TreeNode interface with additional properties
export interface TreeNode extends BaseTreeNode {
  hasAccount?: boolean
  hasParent?: boolean
  companyId?: number
  hasGrandParent?: boolean
  children?: TreeNode[]
}

/**
 * Fetches all companies from the API
 * @returns A promise that resolves to the companies data
 */
export const fetchCompanies = async () => {
  try {
    const payload = await getPayload({ config })

    return await payload.find({
      collection: 'companies',
      depth: 2, // Fetch subCompanies and their subCompanies
      limit: 0,
      sort: 'name',
      where: {
        active: {
          equals: true,
        },
      },
      // Include mainAccount to check if company has accounts
      select: {
        id: true,
        name: true,
        companyId: true,
        subCompanies: true,
        parentCompany: true,
        mainAccount: true,
      },
    })
  } catch (error) {
    console.error('Error fetching companies:', error)
    throw new Error('Failed to fetch companies')
  }
}

/**
 * Fetches a single company by ID
 * @param id The ID of the company to fetch
 * @returns A promise that resolves to the company data
 */
export const fetchCompanyById = async (id: string) => {
  try {
    const payload = await getPayload({ config })

    return await payload.findByID({
      collection: 'companies',
      id,
      depth: 3, // Fetch more details for a single company
    })
  } catch (error) {
    console.error(`Error fetching company with ID ${id}:`, error)
    throw new Error('Failed to fetch company')
  }
}

/**
 * Transforms a flat company structure into a hierarchical tree
 * @param userCompanies The flat company structure
 * @returns A hierarchical tree of companies
 */
export const transformCompaniesToTree = (userCompanies: CompanyData[]): TreeNode[] => {
  // Create a map of all companies by their ID
  const companyMap = new Map<string, TreeNode>()
  // Create TreeNode objects for all companies
  userCompanies.forEach((companyData) => {
    const company = companyData.company
    if (company) {
      const treeNode: TreeNode = {
        id: company.id || String(company.companyId),
        name: company.name || '',
        children: [],
        hasAccount: company.mainAccount && company.mainAccount.length > 0,
        hasParent: company.parentCompany !== undefined && company.parentCompany !== null,
        hasGrandParent:
          company.parentCompany !== undefined &&
          company.parentCompany !== null &&
          company.parentCompany?.docs[0] != null,
        companyId: companyData.companyId,
      }
      companyMap.set(treeNode.id, treeNode)
    }
  })
  // Process subCompanies to build the hierarchy
  userCompanies.forEach((companyData) => {
    const company = companyData.company
    if (company && company.subCompanies && Array.isArray(company.subCompanies)) {
      const parentNode = companyMap.get(company.id || String(company.companyId))
      if (parentNode) {
        // Add each subCompany as a child
        company.subCompanies.forEach((subCompany: Company | string) => {
          let subCompanyId: string
          let subCompanyName: string
          // Handle subCompany as either an object or just an ID
          if (typeof subCompany === 'string') {
            // If subCompany is just an ID string
            subCompanyId = subCompany
            // Try to find the name from the map
            const subCompanyNode = Array.from(companyMap.values()).find(
              (node) => node.id === subCompany,
            )
            subCompanyName = subCompanyNode?.name || subCompanyId
          } else {
            // If subCompany is an object
            subCompanyId = subCompany.id || String(subCompany.companyId)
            subCompanyName = subCompany.name || ''
          }
          // Check if this subCompany already exists in the map
          const existingNode = companyMap.get(subCompanyId)
          if (existingNode) {
            // If it exists, add it as a child to the parent
            if (!parentNode.children) {
              parentNode.children = []
            }
            parentNode.children.push(existingNode)
          } else {
            // If it doesn't exist yet, create a new node and add it
            const newNode: TreeNode = {
              id: subCompanyId,
              name: subCompanyName,
              children: [],
              hasAccount: false, // Default to false for subCompanies as we don't have this info
              hasParent: true, // It's a subCompany, so it has a parent
              companyId: subCompany.companyId,
              hasGrandParent: false,
            }
            companyMap.set(subCompanyId, newNode)
            if (!parentNode.children) {
              parentNode.children = []
            }
            parentNode.children.push(newNode)
          }
        })
      }
    }

    // Process parentCompany if it exists
    if (company && company.parentCompany) {
      let parentCompanies: any[] = []

      // Handle different parentCompany data structures
      if (company.parentCompany.docs && Array.isArray(company.parentCompany.docs)) {
        // If parentCompany has a docs array
        parentCompanies = company.parentCompany.docs
      } else if (Array.isArray(company.parentCompany)) {
        // If parentCompany is an array
        parentCompanies = company.parentCompany
      } else {
        // If parentCompany is a single object
        parentCompanies = [company.parentCompany]
      }

      // Process each parent company
      parentCompanies.forEach((parentCompany) => {
        if (!parentCompany) return

        const childNode = companyMap.get(company.id || String(company.companyId))
        if (!childNode) return

        const parentId = parentCompany.id || String(parentCompany.companyId)
        const parentName = parentCompany.name || ''

        // Check if this parent company already exists in the map
        let parentNode = companyMap.get(parentId)
        if (!parentNode) {
          // If it doesn't exist yet, create a new node and add it
          parentNode = {
            id: parentId,
            name: parentName,
            children: [childNode],
            hasAccount: false, // Default to false for parent companies as we don't have this info
            hasParent: false, // Default to false, will be updated if it has a parent
            companyId: parentCompany.companyId,
            hasGrandParent: false,
          }
          companyMap.set(parentId, parentNode)
        } else {
          // If it exists, add the child to it if not already added
          if (!parentNode.children) {
            parentNode.children = []
          }

          // Check if child is already in parent's children
          const childExists = parentNode.children.some((child) => child.id === childNode.id)
          if (!childExists) {
            parentNode.children.push(childNode)
          }
        }
      })
    }
  })

  // First, get all companies that are already in the tree (either as parents or children)
  const companiesInTree = new Set<string>()

  // Find all companies that are already in the tree structure
  const findCompaniesInTree = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      companiesInTree.add(node.id)
      if (node.children && node.children.length > 0) {
        findCompaniesInTree(node.children)
      }
    })
  }

  // Get root companies (those without parents)
  const rootCompanies = Array.from(companyMap.values()).filter((node) => {
    // Find if this node is a child of any other node
    const isChild = Array.from(companyMap.values()).some((potentialParent) =>
      potentialParent.children?.some((child) => child.id === node.id),
    )
    return !isChild
  })

  // Find all companies that are already in the tree
  findCompaniesInTree(rootCompanies)

  // Get all companies that are not already in the tree
  const standaloneCompanies = Array.from(companyMap.values()).filter(
    (company) => !companiesInTree.has(company.id),
  )

  // Return all root companies and standalone companies
  return [...rootCompanies, ...standaloneCompanies]
}
