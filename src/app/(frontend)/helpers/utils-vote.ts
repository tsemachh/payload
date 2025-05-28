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

        if (parent) {
          // Find all children of this parent that are in meetingCompanies
          const childrenHoldings = meetingCompanies.filter((mc) =>
            parent.subCompanies?.some((child) => child.id === mc.id)
          )

          const percentageHolding = childrenHoldings.reduce((sum, c) => sum + (c.percentageHolding || 0), 0)
          const holdingValueInMillions = childrenHoldings.reduce((sum, c) => sum + (c.holdingValueInMillions || 0), 0)
          const nominalValue = childrenHoldings.reduce((sum, c) => sum + (c.nominalValue || 0), 0)

          const company = {
            id: parent.id,
            name: parent.name,
            percentageHolding,
            holdingValueInMillions,
            nominalValue,
          }

          return [company.id, company]
        } else {
          const company = {
            id: leaf.id,
            name: leaf.holdingsCompanyName,
            percentageHolding: leaf.percentageHolding,
            holdingValueInMillions: leaf.holdingValueInMillions,
            nominalValue: leaf.nominalValue,
          }
          return [company.id, company]
        }
      })
    ).values()
  )

  return uniqueCompanies.map((company) => ({
    id: company.id,
    name: company.name,
    percentageHolding: company.percentageHolding,
    holdingValueInMillions: company.holdingValueInMillions,
    nominalValue: company.nominalValue,
  }))
}

