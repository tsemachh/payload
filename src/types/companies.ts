export type TreeCompanyType = {
  id: string
  name: string
  active: boolean
  subCompanies?: TreeCompanyType[]
}
