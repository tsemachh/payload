
export interface CompanyType {
  id: string
  name: string
  parentCompany?: string | null
  subCompanies?: string[]
}

export interface FundType {
  id: string
  name: string
  parentCompany?: string | null
}
