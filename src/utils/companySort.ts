/**
 * Utility functions for sorting companies by their defined order (fractional indexing)
 */

import { VoteData } from '@/admincomponents/custom-views/voting-form'

/**
 * Sorts group entries by parent company order
 * @param groupEntries Array of [parentCompany, subsidiaries] entries
 * @param orderMap Map of company ID to order string
 * @returns Sorted group entries
 */
export const ORDER_MAX_SENTINEL ='zzzzzzzzzzzzzzz'
export function sortGroupsByParentOrder<T extends { parentCompanyId?: string }>(
  groupEntries: Array<[string, T[]]>,
  orderMap: Map<string, string>,
): Array<[string, T[]]> {
  return groupEntries.sort(([parentCompanyA, subsidiariesA], [parentCompanyB, subsidiariesB]) => {
    // Get the parent company ID from the first subsidiary in each group
    const parentIdA = subsidiariesA[0]?.parentCompanyId || ''
    const parentIdB = subsidiariesB[0]?.parentCompanyId || ''

    const orderA = orderMap.get(parentIdA) ?? ORDER_MAX_SENTINEL
    const orderB = orderMap.get(parentIdB) ?? ORDER_MAX_SENTINEL

    return orderA < orderB ? -1 : orderA > orderB ? 1 : 0
  })
}

/**
 * Sorts nested group entries (for voted companies with checksum groups)
 * This sorts the parent company groups by their order.
 * Note: Checksum groups within each parent should be sorted separately in the calling code
 * by the first company's order in each checksum group.
 * @param nestedGroupEntries Array of [parentCompany, checksumGroups] entries
 * @param orderMap Map of company ID to order string
 * @returns Sorted nested group entries
 */
export function sortNestedGroupsByParentOrder<T extends { parentCompanyId?: string }>(
  nestedGroupEntries: Array<[string, Map<string, T[]>]>,
  orderMap: Map<string, string>,
): Array<[string, Map<string, T[]>]> {
  return nestedGroupEntries.sort(
    ([parentCompanyA, checksumGroupsA], [parentCompanyB, checksumGroupsB]) => {
      // Get the parent company ID from the first company in the first checksum group
      const firstCompaniesA = Array.from(checksumGroupsA.values())[0] || []
      const firstCompaniesB = Array.from(checksumGroupsB.values())[0] || []

      const parentIdA = firstCompaniesA[0]?.parentCompanyId || ''
      const parentIdB = firstCompaniesB[0]?.parentCompanyId || ''

      const orderA = orderMap.get(parentIdA) ?? ORDER_MAX_SENTINEL
      const orderB = orderMap.get(parentIdB) ?? ORDER_MAX_SENTINEL

      return orderA < orderB ? -1 : orderA > orderB ? 1 : 0
    },
  )
}

/**
 * Sorts companies within a group by their order
 * @param companies Array of companies within a group
 * @param orderMap Map of company ID to order string
 * @returns Sorted companies
 */
export function sortCompaniesWithinGroup<T extends { id: string }>(
  companies: T[],
  orderMap: Map<string, string>,
): T[] {
  return [...companies].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? ORDER_MAX_SENTINEL
    const orderB = orderMap.get(b.id) ?? ORDER_MAX_SENTINEL
    return orderA < orderB ? -1 : orderA > orderB ? 1 : 0
  })
}

/**
 * Sorts checksum group entries by the order of the first company in each group
 * This ensures that when multiple companies under the same parent have different checksums,
 * they appear in the correct order based on their _order field
 * @param checksumEntries Array of [checksum, companies] entries
 * @param orderMap Map of company ID to order string
 * @returns Sorted checksum entries
 */
export function sortChecksumGroupsByFirstCompanyOrder<T extends { id: string }>(
  checksumEntries: Array<[string, T[]]>,
  orderMap: Map<string, string>,
): Array<[string, T[]]> {
  return checksumEntries.sort(([_checksumA, companiesA], [_checksumB, companiesB]) => {
    const firstCompanyOrderA = orderMap.get(companiesA[0]?.id) ?? ORDER_MAX_SENTINEL
    const firstCompanyOrderB = orderMap.get(companiesB[0]?.id) ?? ORDER_MAX_SENTINEL
    
    return firstCompanyOrderA < firstCompanyOrderB ? -1 : firstCompanyOrderA > firstCompanyOrderB ? 1 : 0
  })
}
export const sortFundsData = (fundsData: VoteData['fundsData']) => {
  return [...fundsData].sort((a, b) => {
    const companyOrderA = a.company._order ?? ORDER_MAX_SENTINEL
    const companyOrderB = b.company._order ?? ORDER_MAX_SENTINEL

    const companyComparison =
      companyOrderA < companyOrderB ? -1 : companyOrderA > companyOrderB ? 1 : 0

    if (companyComparison !== 0) {
      return companyComparison
    }

    const fundOrderA = a.fund._order ?? ORDER_MAX_SENTINEL
    const fundOrderB = b.fund._order ?? ORDER_MAX_SENTINEL

    return fundOrderA < fundOrderB ? -1 : fundOrderA > fundOrderB ? 1 : 0
  })
}
