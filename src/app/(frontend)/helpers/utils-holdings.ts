import { TreeNode } from "../holdings/components/CompanySelector"

export const transformCompaniesToTree = (userCompanies: any[]): TreeNode[] => {
    // Create a map of all companies by their ID
    const companyMap = new Map<string, TreeNode>()
    // Create TreeNode objects for all companies
    userCompanies.forEach((companyData) => {
      const company = companyData.companyId
      if (company) {
        const treeNode: TreeNode = {
          id: company.id || String(company.companyId),
          name: company.name || '',
          children: [],
        }
        companyMap.set(treeNode.id, treeNode)
      }
    })
    // Process subCompanies to build the hierarchy
    userCompanies.forEach((companyData) => {
      const company = companyData.companyId
      if (company && company.subCompanies && Array.isArray(company.subCompanies)) {
        const parentNode = companyMap.get(company.id || String(company.companyId))
        if (parentNode) {
          // Add each subCompany as a child
          company.subCompanies.forEach((subCompany: any) => {
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
    })
  
    // Return only root nodes (those without parents or with empty parentCompany)
    return Array.from(companyMap.values()).filter((node) => {
      // Find if this node is a child of any other node
      const isChild = Array.from(companyMap.values()).some((potentialParent) =>
        potentialParent.children?.some((child) => child.id === node.id),
      )
      return !isChild
    })
  }