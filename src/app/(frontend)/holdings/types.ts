export interface Holding {
  id: string | number
  company: string
  stockNumber: string
  quantity: number
  lastUpdated: string
}

export interface HoldingProcessingError {
  lineNumber?: number
  stockId?: string
  accountId?: string
  quantity?: string
  error: string
}