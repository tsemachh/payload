import { User } from '@/payload-types'

export type PermissionType = 'read' | 'write'

/**
 * Check if a user has permission for a specific company
 * @param user The user object
 * @param companyId The ID of the company to check
 * @param permissionType The type of permission to check (read or write)
 * @returns True if the user has the specified permission, false otherwise
 */
export function hasCompanyPermission(
  user: User | null | undefined,
  companyId: string,
  permissionType: PermissionType = 'read',
): boolean {
  // Admin users have all permissions
  //if (user?.authUtils) return true

  // If no user or no companies, no permissions
  if (!user || !user.companies) return false

  // Find the company in the user's companies array
  const companyEntry = user.companies.find((entry) =>
    typeof entry.companyId === 'string'
      ? entry.companyId === companyId
      : entry.companyId.id === companyId,
  )

  if (!companyEntry) return false

  // For read permission, either read or write is sufficient
  if (permissionType === 'read') {
    return companyEntry.permission === 'read' || companyEntry.permission === 'write'
  }

  // For write permission, only write is sufficient
  return companyEntry.permission === 'write'
}

/**
 * Get all companies that a user has a specific permission for
 * @param user The user object
 * @param permissionType The type of permission to check (read or write)
 * @returns Array of company IDs that the user has the specified permission for
 */
export function getCompaniesWithPermission(
  user: User | null | undefined,
  permissionType: PermissionType = 'read',
): string[] {
  /*
  // Admin users have all permissions for all companies
  if (user?.authUtils && user.funds) {
    return user.funds.map(fund => typeof fund === 'string' ? fund : fund.id)
  }
*/

  // If no user or no companies, no permissions
  if (!user || !user.companies) return []

  // Filter companies based on permission
  return user.companies
    .filter((entry) => {
      if (permissionType === 'read') {
        return entry.permission === 'read' || entry.permission === 'write'
      }
      return entry.permission === 'write'
    })
    .map((entry) => (typeof entry.companyId === 'string' ? entry.companyId : entry.companyId.id))
}
