import { StockType } from '@/payload-types'

export default interface ImportStock {
  stockID: number | string
  name: string
  symbol: string
  type: StockType
  closingRate: number
  marketValue: number
  registeredValue: number
  valueDate: string // ISO date string (e.g., "2021-11-10T00:00:00")
  longName?: string
}
