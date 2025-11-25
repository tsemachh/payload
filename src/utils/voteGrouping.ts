import { getIdOfRelationField } from '@/utils/utils'

// Helper to extract parent company ID from join object or string
export const getParentCompanyId = (parentCompany: any): string | null => {
  if (!parentCompany) return null
  // Handle join object format: {docs: ["id"], hasNextPage: false}
  if (parentCompany?.docs && Array.isArray(parentCompany.docs) && parentCompany.docs.length > 0) {
    return typeof parentCompany.docs[0] === 'string' ? parentCompany.docs[0] : null
  }
  // Handle string ID
  if (typeof parentCompany === 'string') return parentCompany
  // Handle object with id property
  if (parentCompany?.id) return parentCompany.id
  return null
}
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
  // Use the unified grouping function
  const nestedGroups = groupByParentAndChecksum(votes, {
    getParentKey: (vote) => {
      const companyId = getIdOfRelationField(vote.company) as string
      return companyToParentMap.get(companyId) || companyId
    },
    getChecksum: (vote) => vote.checksum || '',
  })

  // Convert nested structure to flat structure for backward compatibility
  const result = new Map<string, { voteIds: string[]; companies: Set<string> }>()

  nestedGroups.forEach((checksumMap, parentCompanyId) => {
    checksumMap.forEach((votes, checksum) => {
      if (checksum && votes.length > 0) {
        const groupKey = `${parentCompanyId}|${checksum}`
        const voteIds = votes.map((vote) => vote.id)
        const companies = new Set(votes.map((vote) => getIdOfRelationField(vote.company) as string))
        result.set(groupKey, { voteIds, companies })
      }
    })
  })

  return result
}

/**
 * Creates a map of company ID to parent company ID from votes with parentCompany virtual field
 * @param votes - Array of vote objects with company and parentCompany fields
 * @returns Map of company ID to parent company ID
 */
export function createCompanyToParentMapFromVotes(votes: any[]): Map<string, string> {
  const companyToParentMap = new Map<string, string>()

  votes.forEach((vote: any) => {
    const companyId = getIdOfRelationField(vote.company)
    if (!companyId) return

    // Use getParentCompanyId helper to handle join object format
    const parentCompanyId = getParentCompanyId(vote.parentCompany) || String(companyId)
    companyToParentMap.set(String(companyId), parentCompanyId)
  })

  return companyToParentMap
}

/**
 * Groups companies by parent company name (first level grouping)
 * @param companies - Array of company objects with parentCompany field
 * @returns Map of parent company name to array of companies
 */
export function groupCompaniesByParent(companies: any[]): Map<string, any[]> {
  const parentCompanyGroups = new Map<string, any[]>()

  companies.forEach((company) => {
    const parentKey = company.parentCompany || company.name
    if (!parentCompanyGroups.has(parentKey)) {
      parentCompanyGroups.set(parentKey, [])
    }
    parentCompanyGroups.get(parentKey)!.push(company)
  })

  return parentCompanyGroups
}

/**
 * Unified grouping function that works with both votes and companies
 * Groups items by parent company and checksum (two-level grouping)
 * @param items - Array of items (votes or companies with vote data)
 * @param options - Configuration for how to extract parent and checksum
 * @returns Map of parent key to Map of checksum to items
 */
export function groupByParentAndChecksum<T = any>(
  items: T[],
  options: {
    getParentKey: (item: T) => string
    getChecksum: (item: T) => string
  },
): Map<string, Map<string, T[]>> {
  const result = new Map<string, Map<string, T[]>>()

  items.forEach((item) => {
    const parentKey = options.getParentKey(item)
    const checksumKey = options.getChecksum(item)

    if (!result.has(parentKey)) {
      result.set(parentKey, new Map())
    }

    const checksumMap = result.get(parentKey)!
    if (!checksumMap.has(checksumKey)) {
      checksumMap.set(checksumKey, [])
    }

    checksumMap.get(checksumKey)!.push(item)
  })

  return result
}

/**
 * Groups companies by parent company name and checksum (two-level grouping)
 * @param companies - Array of company objects with parentCompany and vote.checksum
 * @returns Map of parent company name to Map of checksum to companies
 */
export function groupCompaniesByParentAndChecksum(
  companies: any[],
): Map<string, Map<string, any[]>> {
  return groupByParentAndChecksum(companies, {
    getParentKey: (company) => company.parentCompany || company.name,
    getChecksum: (company) => company.vote?.checksum || 'ללא checksum',
  })
}

export function getGroupedVotesUrl(
  meetingId: string | number,
  parentCompanyId: string,
  checksum: string,
): string {
  return `/admin/grouped-votes/?meetingId=${meetingId}&parentCompanyId=${parentCompanyId}&checksum=${checksum}`
}
