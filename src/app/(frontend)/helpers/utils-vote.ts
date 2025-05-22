import { CompanyType, LeafCompanyType } from '../types/companies'
import { CompanyTableDate } from '../types/meetings'
import { VoteCompanyType } from '../types/vote'

export function getParentCompaniesOfMeetingCompanies(
  meetingCompanies: CompanyTableDate[],
  leafCompanies: LeafCompanyType[],
  companies: CompanyType[],
): VoteCompanyType[] {
  const result: VoteCompanyType[] = []

  for (const item of meetingCompanies) {
    const match = leafCompanies.find((leaf) => leaf.id === item.id)

    if (match) {
      if (match.parentCompany) {
        const parentCompany = companies?.find((company) => company.id === match.parentCompany)
        if (parentCompany) {
          result.push({ id: parentCompany.id, name: parentCompany.name })
        } else {
          console.error('no parent company found for leaf company', match)
        }
      } else {
        result.push({ id: match.id, name: match.name })
      }
    }
  }
  return result
}
