export type TreeCompanyType = {
  id: string
  name: string
  subCompanies?: TreeCompanyType[]
}
