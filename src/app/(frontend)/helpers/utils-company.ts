import { stringify } from 'qs-esm'

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
  companyId?: number | null
  active?: boolean
  type?: string
  subCompanies?: Array<Company | string>
  parentCompany?:
    | {
        docs?: Company[]
      }
    | Company[]
    | Company
  mainAccount?: Account[]
  privateRegistrationNumber?: number[]
  silencedStocks?: string[]
  holdings?: { docs?: any[] }
  meetings?: { docs?: any[] }
}

// Define company data interface
export interface CompanyData {
  company: Company
  companyId?: number
}

// Extended TreeNode interface with additional properties
export interface TreeNode {
  id: string
  name: string
  hasAccount?: boolean
  hasParent?: boolean
  companyId?: number
  hasGrandParent?: boolean
  children?: TreeNode[]
  type: string
  privateRegistrationNumber?: number[]
}

/**
 * Fetches all companies from the API
 * @returns A promise that resolves to the companies data
 */
export const fetchCompanies = async () => {
  try {
    const query = {
      where: {
        active: {
          equals: true,
        },
        type: {
          in: ['parent', 'regular'],
        },
        // Removed type filter to include all company types
      },
      depth: 4,
      limit: 0,
      sort: 'name',
      select: {
        type: true,
        id: true,
        name: true,
        companyId: true,
        subCompanies: true,
        'subCompanies.subCompanies': true,
        'subCompanies.subCompanies.subCompanies': true,
        'subCompanies.subCompanies.subCompanies.subCompanies': true,
        parentCompany: true,
        mainAccount: true,
        privateRegistrationNumber: true,
      },
    }

    const stringifiedQuery = stringify(query, { addQueryPrefix: true })
    const response = await fetch(`/api/companies${stringifiedQuery}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
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
    const query = {
      depth: 3, // Fetch more details for a single company
      select: {
        id: true,
        name: true,
        companyId: true,
        active: true,
        type: true,
        subCompanies: true,
        parentCompany: true,
        mainAccount: true,
        silencedStocks: true,
        privateRegistrationNumber: true,
        meetings: {
          docs: true,
        },
      },
    }

    const stringifiedQuery = stringify(query, { addQueryPrefix: true })
    const response = await fetch(`/api/companies/${id}${stringifiedQuery}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
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
      const hasAccount = company.mainAccount && company.mainAccount.length > 0
      // Normalize parentCompany (relationship can be string ID or populated object)
      const pc: any = (company as any)?.parentCompany
      const getId = (val: any): string | undefined => {
        if (!val) return undefined
        if (typeof val === 'string') return val
        if (typeof val === 'object') {
          // common shapes: { id }, { value }, populated Company
          if (typeof val.id === 'string') return val.id
          if (typeof val.value === 'string') return val.value
        }
        return undefined
      }
      const hasParent = Boolean(getId(pc))
      const hasGrandParent = Boolean(
        pc && typeof pc === 'object' && getId((pc as any).parentCompany),
      )
      const treeNode: TreeNode = {
        id: company.id || String(company.companyId),
        name: company.name || '',
        children: [],
        hasAccount,
        hasParent,
        hasGrandParent,
        companyId: companyData.companyId,
        type: companyData.company.type as string,
        privateRegistrationNumber: company.privateRegistrationNumber,
      }
      companyMap.set(treeNode.id, treeNode)
    }
  })
  // Process subCompanies to build the hierarchy
  const processSubCompanies = (company: Company, parentNode: TreeNode) => {
    if (company && company.subCompanies && Array.isArray(company.subCompanies)) {
      // Add each subCompany as a child
      company.subCompanies.forEach((subCompany: Company | string) => {
        let subCompanyId: string
        let subCompanyName: string
        let subCompanyObj: Company | null = null

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
          subCompanyObj = subCompany
        }

        // Check if this subCompany already exists in the map
        const existingNode = companyMap.get(subCompanyId)
        let nodeToUse: TreeNode

        if (existingNode) {
          // If it exists, check if it's already a child of the parent by name
          if (!parentNode.children) {
            parentNode.children = []
          }
          // Check if a node with the same name already exists in the parent's children
          const nodeExistsByName = parentNode.children.some(
            (child) => child.name === existingNode.name,
          )
          if (!nodeExistsByName) {
            parentNode.children.push(existingNode)
          }
          nodeToUse = existingNode
        } else {
          // If it doesn't exist yet, create a new node and add it
          const newNode: TreeNode = {
            id: subCompanyId,
            name: subCompanyName,
            children: [],
            hasAccount: false, // Default to false for subCompanies as we don't have this info
            hasParent: true, // It's a subCompany, so it has a parent
            companyId:
              typeof subCompany === 'string' ? undefined : (subCompany.companyId ?? undefined),
            hasGrandParent: false,
            type: typeof subCompany !== 'string' ? (subCompany?.type as string) : 'regular',
            privateRegistrationNumber:
              typeof subCompany === 'string' ? undefined : subCompany.privateRegistrationNumber,
          }
          companyMap.set(subCompanyId, newNode)
          if (!parentNode.children) {
            parentNode.children = []
          }
          parentNode.children.push(newNode)
          nodeToUse = newNode
        }

        // Recursively process subCompanies of this subCompany if it's an object
        if (
          subCompanyObj &&
          subCompanyObj.subCompanies &&
          Array.isArray(subCompanyObj.subCompanies)
        ) {
          processSubCompanies(subCompanyObj, nodeToUse)
        }
      })
    }
  }

  userCompanies.forEach((companyData) => {
    const company = companyData.company
    if (company && company.subCompanies && Array.isArray(company.subCompanies)) {
      const parentNode = companyMap.get(company.id || String(company.companyId))
      if (parentNode) {
        processSubCompanies(company, parentNode)
      }
    }

    // Process parentCompany if it exists
    if (company && company.parentCompany) {
        const pcAny: any = company.parentCompany as any
        const addLinkToParent = (parentId: string, parentName?: string, parentCompanyObj?: Company) => {
          const childNode = companyMap.get(company.id || String(company.companyId))
          if (!childNode) return
          let parentNode = companyMap.get(parentId)
          if (!parentNode) {
            parentNode = {
              id: parentId,
              name: parentName || '',
              children: [childNode],
              hasAccount: false,
              hasParent: false,
              companyId: parentCompanyObj?.companyId ?? undefined,
              hasGrandParent: false,
              type: companyData.company.type as string,
              privateRegistrationNumber: parentCompanyObj?.privateRegistrationNumber,
            }
            companyMap.set(parentId, parentNode)
          } else {
            if (!parentNode.children) parentNode.children = []
            const childExistsById = parentNode.children.some((child) => child.id === childNode.id)
            const childExistsByName = parentNode.children.some((child) => child.name === childNode.name)
            if (!childExistsById && !childExistsByName) parentNode.children.push(childNode)
          }
        }

        // Handle different parentCompany data structures
        if (typeof pcAny === 'string') {
          addLinkToParent(pcAny)
        } else if (typeof pcAny === 'object') {
          if ('docs' in pcAny && Array.isArray(pcAny.docs)) {
            pcAny.docs.forEach((parentCompany: Company) => {
              const parentId = parentCompany.id || String(parentCompany.companyId)
              addLinkToParent(parentId, parentCompany.name || '', parentCompany)
            })
          } else if (Array.isArray(pcAny)) {
            pcAny.forEach((parentCompany: Company) => {
              const parentId = parentCompany.id || String(parentCompany.companyId)
              addLinkToParent(parentId, parentCompany.name || '', parentCompany)
            })
          } else {
            const parentCompany = pcAny as Company
            const parentId = parentCompany.id || String(parentCompany.companyId)
            addLinkToParent(parentId, parentCompany.name || '', parentCompany)
          }
        }
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
  const result = [...rootCompanies, ...standaloneCompanies]
  console.log('Transformed companies tree:', result)
  return result
}
