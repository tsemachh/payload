
export interface CompanyType {
  id: string
  name: string
  parentCompany?: string | null
  subCompanies?: string[]
}

export interface LeafCompanyType {
  id: string
  name: string
  parentCompany?: string | null
}
