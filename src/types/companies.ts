export type MinimalCompany = {
    id: string
    name: string
    subCompanies?: MinimalCompany[]
  }
  