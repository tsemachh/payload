import { TreeCompanyType } from '@/types/companies'
import { CompanyTableDate } from '../types/meetings'
import { VoteCompanyType } from '../types/vote'

export function getParentCompanies(
  meetingCompanies: CompanyTableDate[],
  treeCompanies: TreeCompanyType[],
): VoteCompanyType[] {
  const findParent = (targetId: string, nodes: TreeCompanyType[]): TreeCompanyType | null => {
    for (const node of nodes) {
      if (node.subCompanies?.some((child) => child.id === targetId)) {
        return node
      }
      if (node.subCompanies && node.subCompanies.length > 0) {
        const parent = findParent(targetId, node.subCompanies)
        if (parent) return parent
      }
    }
    return null
  }

  const uniqueCompanies = Array.from(
    new Map(
      meetingCompanies.map((leaf) => {
        const parent = findParent(leaf.id, treeCompanies)
        const company = parent
          ? { id: parent.id, name: parent.name }
          : { id: leaf.id, name: leaf.holdingsCompanyName }
        return [company.id, company]
      }),
    ).values(),
  )
  return uniqueCompanies.map((company) => ({
    id: company.id,
    name: company.name,
  }))
}
