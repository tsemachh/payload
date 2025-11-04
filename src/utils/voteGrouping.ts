import { getIdOfRelationField } from '@/utils/utils'

/**
 * Groups votes by parent company and checksum
 * @param votes - Array of vote objects with company and checksum fields
 * @param companyToParentMap - Map of company ID to parent company ID
 * @returns Map of groupKey (parentCompanyId|checksum) to vote data
 */
export function groupVotesByParentAndChecksum(
  votes: any[],
  companyToParentMap: Map<string, string>,
): Map<string, { voteIds: string[]; companies: Set<string> }> {
  const votesByMotherAndChecksum = new Map<string, { voteIds: string[]; companies: Set<string> }>()

  votes.forEach((vote: any) => {
    const checksum = vote.checksum
    const companyId = getIdOfRelationField(vote.company) as string
    const parentCompanyId = companyToParentMap.get(companyId) || companyId

    const groupKey = `${parentCompanyId}|${checksum}`

    if (checksum && companyId && parentCompanyId) {
      if (!votesByMotherAndChecksum.has(groupKey)) {
        votesByMotherAndChecksum.set(groupKey, { voteIds: [], companies: new Set() })
      }
      votesByMotherAndChecksum.get(groupKey)?.voteIds.push(vote.id)
      votesByMotherAndChecksum.get(groupKey)?.companies.add(companyId)
    }
  })

  return votesByMotherAndChecksum
}

/**
 * Creates a map of company ID to parent company ID
 * @param companies - Array of company objects with parentCompany field
 * @returns Map of company ID to parent company ID
 */
export function createCompanyToParentMap(companies: any[]): Map<string, string> {
  const companyToParentMap = new Map<string, string>()

  companies.forEach((company: any) => {
    let parentCompanyId = company.id // Default to company itself if no parent
    if (
      company?.parentCompany?.docs &&
      Array.isArray(company.parentCompany.docs) &&
      company.parentCompany.docs.length > 0
    ) {
      const parentCompany = company.parentCompany.docs[0]
      parentCompanyId =
        typeof parentCompany === 'string' ? parentCompany : parentCompany?.id || company.id
    }
    companyToParentMap.set(company.id, parentCompanyId)
  })

  return companyToParentMap
}
/**
 * Extracts parent company name from company object (for frontend use)
 * @param company - Company object with parentCompany field
 * @returns Parent company name or null
 */
export function getParentCompanyName(company: any): string | null {
  return (
    company.parentCompany?.docs?.[0]?.name ||
    (typeof company.parentCompany === 'string' ? company.parentCompany : null)
  )
}

/**
 * Groups companies by parent company name (first level grouping)
 * @param companies - Array of company objects with parentCompany field
 * @returns Map of parent company name to array of companies
 */
export function groupCompaniesByParent(companies: any[]): Map<string, any[]> {
  const parentCompanyGroups = new Map<string, any[]>()

  companies.forEach((company) => {
    const motherKey = company.parentCompany || company.name
    if (!parentCompanyGroups.has(motherKey)) {
      parentCompanyGroups.set(motherKey, [])
    }
    parentCompanyGroups.get(motherKey)!.push(company)
  })

  return parentCompanyGroups
}

/**
 * Groups companies by checksum (second level grouping)
 * @param companies - Array of company objects with vote.checksum field
 * @returns Map of checksum to array of companies
 */
export function groupCompaniesByChecksum(companies: any[]): Map<string, any[]> {
  const checksumGroups = new Map<string, any[]>()

  companies.forEach((company) => {
    const checksumKey = company.vote?.checksum || 'ללא checksum'
    if (!checksumGroups.has(checksumKey)) {
      checksumGroups.set(checksumKey, [])
    }
    checksumGroups.get(checksumKey)!.push(company)
  })

  return checksumGroups
}

/**
 * Groups companies by parent company name and checksum (two-level grouping)
 * @param companies - Array of company objects with parentCompany and vote.checksum
 * @returns Map of parent company name to Map of checksum to companies
 */
export function groupCompaniesByParentAndChecksum(
  companies: any[],
): Map<string, Map<string, any[]>> {
  const parentCompanyGroups = groupCompaniesByParent(companies)

  // Then group each mother company's subsidiaries by checksum
  const result = new Map<string, Map<string, any[]>>()
  parentCompanyGroups.forEach((companies, parentCompany) => {
    const checksumGroups = groupCompaniesByChecksum(companies)
    result.set(parentCompany, checksumGroups)
  })

  return result
}
