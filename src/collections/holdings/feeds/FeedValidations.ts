import {
  ACCOUNT_ID_COL,
  FeedFatalError,
  FeedWarning,
  QUANTITY_COL,
  StandardizedRow,
  STOCK_ID_COL,
} from '@/collections/holdings/feeds/FeedTypes'
import { PayloadRequest } from 'payload'
import { HoldingFeedLine } from '@/payload-types'
import { getPreviousFeed } from '@/collections/holdings/feeds/FeedDataUtils'
import { containsHebrewText } from '@/collections/holdings/feeds/FeedUtils'

export type HoldingFeedLineWithName = HoldingFeedLine & {
  stockName?: string | null
  companyName?: string | null
}

/**
 * Validate the whole feed for fatal errors
 * @param results The parsed file content
 * @returns Object containing fatal errors and optional header warning
 */
export const validateWholeFeed = (
  results: Array<any>,
): { fatalErrors: FeedFatalError[]; headerWarning?: FeedWarning } => {
  const fatalErrors: FeedFatalError[] = []
  let headerWarning: FeedWarning | undefined

  // Check if file is empty
  if (!results || results.length === 0) {
    fatalErrors.push({
      type: 'emptyFile',
      message: 'הקובץ שהוזן ריק',
    })
    return { fatalErrors }
  }

  // Check for Hebrew header in the first row
  let firstRow = results[0]
  let hasHebrewHeader = false

  if (Array.isArray(firstRow)) {
    // For XLSX files
    hasHebrewHeader = firstRow.some((cell) => typeof cell === 'string' && containsHebrewText(cell))
  } else {
    // For CSV files
    const values = Object.values(firstRow)
    hasHebrewHeader = values.some((value) => typeof value === 'string' && containsHebrewText(value))
  }

  if (hasHebrewHeader) {
    headerWarning = {
      type: 'other',
      message: 'נמצאה שורת כותרת בעברית בקובץ. השורה תתעלם בעיבוד.',
    }
    firstRow = results[1]
  }

  // Check column format
  let hasWrongFormat = false
  const formatDetails: string[] = []

  // Check if the first row has the expected columns

  if (Array.isArray(firstRow)) {
    // For XLSX files
    if (firstRow.length !== 3) {
      hasWrongFormat = true
      formatDetails.push(`מספר עמודות שגוי: ${firstRow.length} במקום 3`)
    }
  } else {
    // For CSV files
    const keys = Object.keys(firstRow)
    if (keys.length !== 3) {
      hasWrongFormat = true
      formatDetails.push(`מספר עמודות שגוי: ${keys.length} במקום 3`)
    }
  }

  // Check data types in the first few rows
  for (let i = hasHebrewHeader ? 1 : 0; i < Math.min(results.length, 5); i++) {
    const row = results[i]
    let stockId: string | number | undefined
    let quantity: string | number | undefined
    let accountId: string | number | undefined

    if (Array.isArray(row)) {
      stockId = row[STOCK_ID_COL]
      quantity = row[QUANTITY_COL]
      accountId = row[ACCOUNT_ID_COL]
    } else {
      stockId = row[STOCK_ID_COL.toString()]
      quantity = row[QUANTITY_COL.toString()]
      accountId = row[ACCOUNT_ID_COL.toString()]
    }

    // Check data types
    if (quantity !== undefined && isNaN(Number(quantity))) {
      hasWrongFormat = true
      formatDetails.push(`שורה ${i + 1}: כמות אינה מספר: ${quantity}`)
    }

    if (stockId !== undefined && typeof stockId !== 'string' && typeof stockId !== 'number') {
      hasWrongFormat = true
      formatDetails.push(`שורה ${i + 1}: מזהה נייר ערך אינו מחרוזת: ${stockId}`)
    }

    if (accountId !== undefined && isNaN(Number(accountId))) {
      hasWrongFormat = true
      formatDetails.push(`שורה ${i + 1}: מזהה חשבון אינו מחרוזת: ${accountId}`)
    }
  }

  if (hasWrongFormat) {
    fatalErrors.push({
      type: 'wrongColumnFormat',
      message: 'פורמט הקובץ שהוזן שגוי',
      details: formatDetails,
    })
  }

  return { fatalErrors, headerWarning }
}
/**
 * Check for warnings in the feed
 * @param req The payload request
 * @param valueDate The value date
 * @param accountIds The account IDs in the feed
 * @param standardizedRows The standardized rows
 * @param accountToCompanyMap Map of account numbers to company IDs
 * @param selectedCompanies
 * @returns Array of warnings
 */
export const checkFeedWarnings = async (
  req: PayloadRequest,
  valueDate: string,
  accountIds: number[],
  standardizedRows: StandardizedRow[],
  accountToCompanyMap: Map<number, string>,
  selectedCompanies: string[],
): Promise<FeedWarning[]> => {
  const warnings: FeedWarning[] = []

  // Check for duplicate feed for date
  const existingHoldings = await req.payload.find({
    collection: 'holdings-feed',
    where: {
      valueDate: { equals: new Date(valueDate).toISOString() },
      selectedCompanies: {
        contains: selectedCompanies,
      },
    },
    depth: 0,
    limit: 0,
  })

  if (existingHoldings.docs.length > 0) {
    const formattedDate = valueDate.split('-').reverse().join('/')
    warnings.push({
      type: 'duplicateFeedForDate',
      message: `בוצעה בעבר הזנה לתאריך ${formattedDate}`,
      count: existingHoldings.docs.length,
    })
  }

  // Check for unknown accounts
  const unknownAccounts: string[] = []
  standardizedRows.forEach((row) => {
    const accountId = Number(row?.accountId)
    if (!isNaN(accountId) && !accountToCompanyMap.has(accountId)) {
      if (!unknownAccounts.includes(row.accountId!)) {
        unknownAccounts.push(row.accountId!)
      }
    }
  })
  if (unknownAccounts.length > 0) {
    warnings.push({
      type: 'unknownAccounts',
      message: 'חשבונות לא מוכרים',
      details: unknownAccounts,
      count: unknownAccounts.length,
    })
  }

  // Check for line count difference compared to previous feed
  const previousFeed = await getPreviousFeed(req, valueDate, selectedCompanies)
  if (previousFeed) {
    const previousCount = previousFeed.processingResults?.length || 0
    const currentCount = standardizedRows.length
    const percentDifference =
      previousCount > 0 ? (Math.abs(currentCount - previousCount) / previousCount) * 100 : 0

    if (percentDifference > 5) {
      warnings.push({
        type: 'lineCountDifference',
        message: `חריגה בכמות הרשומות בהשוואה להזנה קודמת`,
        details: [`הזנה קודמת: ${previousCount} שורות`, `הזנה נוכחית: ${currentCount} שורות`],
      })
    }

    const currentAccounts = new Set<string>(accountIds.map((id) => id.toString()))

    // Safely parse accountsJson with null check and try-catch
    let previousAccountsArray: string[] = []
    try {
      if (previousFeed.accountsJson) {
        const parsed = JSON.parse(previousFeed.accountsJson as string)
        previousAccountsArray = parsed?.length ? parsed.map(String) : []
      }
    } catch (error) {
      console.error('Error parsing accountsJson:', error)
      previousAccountsArray = []
    }

    const previousAccounts = new Set<string>(previousAccountsArray)

    // חשבונות שהיו קודם ועכשיו חסרים
    const missingAccounts = previousAccountsArray.filter((account) => !currentAccounts.has(account))

    // חשבונות שעכשיו קיימים אבל לא היו קודם
    const extraAccounts = [...currentAccounts].filter((account) => !previousAccounts.has(account))

    // אזהרות
    if (missingAccounts.length > 0) {
      warnings.push({
        type: 'missingAccounts',
        message: 'חשבונות חסרים בהשוואה להזנה קודמת',
        details: missingAccounts,
        count: missingAccounts.length,
      })
    }

    if (extraAccounts.length > 0) {
      warnings.push({
        type: 'missingAccounts',
        message: 'נמצאו חשבונות חדשים שלא הופיעו בהזנה הקודמת',
        details: extraAccounts,
        count: extraAccounts.length,
      })
    }
  }

  return warnings
}

/**
 * Validate a single row
 * @param row The row to validate
 * @param index The index of the row
 * @param accountMap Map of account numbers to company IDs
 * @param stocksMap Map of stock IDs to stock information objects
 * @param accountNameMap Map of account numbers to account names
 * @param silencedStockIds Array of silenced stock IDs
 * @returns Validation result
 */
export const validateRow = async (
  row: StandardizedRow,
  index: number,
  accountMap: Map<number, string>,
  stocksMap: Map<
    string,
    {
      stockParentMongoId: string
      stockName: string
      isActive: boolean
      origin: string
    }
  >,
  accountNameMap: Map<number, string>,
  silencedStockIds: string[],
): Promise<{
  processedRecord: HoldingFeedLineWithName
}> => {
  const { stockId, quantity, accountId } = row
  const stockInfo = stocksMap.get(stockId!)
  const stockName = stockInfo?.stockName
  const companyName = accountNameMap.get(Number(accountId))

  const lineNumber = index + 1

  let status: 'success' | 'error' | 'silenced' = 'success'
  let errorMessage: string | null = null

  // Check required fields
  if (!stockId) {
    status = 'error'
    errorMessage = 'מספר נייר חסר'
  } else if (isNaN(quantity!) || quantity! < 1) {
    status = 'error'
    errorMessage = 'ערך נקוב לא תקין'
  } else if (!accountId) {
    status = 'error'
    errorMessage = 'מספר חשבון חסר'
  } else if (!stocksMap.has(stockId)) {
    if (silencedStockIds.includes(stockId)) {
      status = 'silenced'
    } else {
      status = 'error'
      errorMessage = 'נייר ערך לא מוכר'
    }
  } else if (!accountMap.has(Number(accountId))) {
    status = 'error'
    errorMessage = 'מספר חשבון לא מוכר'
  } else if (!stockInfo?.isActive) {
    // Check if stock is inactive
    if (silencedStockIds.includes(stockId)) {
      status = 'silenced'
    } else {
      status = 'error'
      errorMessage = 'נייר ערך לא פעיל'
    }
  }

  const processedRecord: HoldingFeedLineWithName = {
    stockId,
    stockName,
    quantity,
    accountId,
    companyName,
    lineNumber,
    status,
    error: errorMessage,
  }

  return { processedRecord }
}
