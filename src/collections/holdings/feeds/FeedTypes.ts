// Define validation types
import { HoldingFeedLine } from '@/payload-types'

export interface FeedValidationResult {
  fatalErrors: FeedFatalError[]
  warnings: FeedWarning[]
  recordErrors: HoldingFeedLine[]
  validRecords: HoldingFeedLine[]
  silencedRecords:HoldingFeedLine[]
}

export interface FeedFatalError {
  type: 'emptyFile' | 'wrongColumnFormat' | 'other'
  message: string
  details?: string[]
}

export interface FeedWarning {
  type:
    | 'duplicateFeedForDate'
    | 'unknownAccounts'
    | 'lineCountDifference'
    | 'missingAccounts'
    | 'other'
  message: string
  details?: string[]
  count?: number
}

export const STOCK_ID_COL = 0
export const QUANTITY_COL = 1
export const ACCOUNT_ID_COL = 2

export interface StandardizedRow {
  stockId: string
  quantity: number
  accountId: string
}
