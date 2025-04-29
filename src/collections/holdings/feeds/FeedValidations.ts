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
export type HoldingFeedLineWithName = HoldingFeedLine & {
  stockName?: string | null;
};

/**
 * Validate the whole feed for fatal errors
 * @param results The parsed file content
 * @returns Array of fatal errors
 */
export const validateWholeFeed = (results: Array<any>): FeedFatalError[] => {
  const fatalErrors: FeedFatalError[] = []

  // Check if file is empty
  if (!results || results.length === 0) {
    fatalErrors.push({
      type: 'emptyFile',
      message: 'הקובץ שהוזן ריק',
    })
    return fatalErrors
  }

  // Check column format
  let hasWrongFormat = false
  const formatDetails: string[] = []

  // Check if the first row has the expected columns
  const firstRow = results[0]

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
  for (let i = 0; i < Math.min(results.length, 5); i++) {
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

  return fatalErrors
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
    limit: 0,
  })

  console.log('-----selectedCompanies', selectedCompanies)

  console.log('-----existingHoldings', existingHoldings)
  if (existingHoldings.docs.length > 0) {
    const formattedDate = valueDate.split('-').reverse().join('/');
    warnings.push({
      type: 'duplicateFeedForDate',
      message: `בוצעה בעבר הזנה לתאריך ${formattedDate}`,
      count: existingHoldings.docs.length,
    })
  }
  console.log('-----existingHoldings')

  // Check for unknown accounts
  const unknownAccounts: string[] = []
  standardizedRows.forEach((row) => {
    const accountId = Number(row.accountId)
    if (!isNaN(accountId) && !accountToCompanyMap.has(accountId)) {
      if (!unknownAccounts.includes(row.accountId)) {
        unknownAccounts.push(row.accountId)
      }
    }
  })
  console.log('-----unknownAccounts', unknownAccounts)

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

    const previousAccountsArray = (JSON.parse(previousFeed.accountsJson as string) as number[]).map(
      String,
    )
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
 * @param accountMap
 * @param stockMap
 * @param silencedStockIds
 * @returns Validation result
 */
export const validateRow = async (
  row: StandardizedRow,
  index: number,
  accountMap: Map<number, string>,
  stockMap: Map<string, string>,
  stockNameMap: Map<string, string>,
  silencedStockIds: string[],
): Promise<{
  processedRecord: HoldingFeedLineWithName
}> => {
  const { stockId, quantity, accountId } = row
  const stockName = stockNameMap.get(stockId)
  const lineNumber = index + 1

  let status: 'success' | 'error' | 'silenced' = 'success'
  let errorMessage: string | null = null

  // Check required fields
  if (!stockId) {
    status = 'error';
    errorMessage = 'מספר נייר חסר';
  } else if (isNaN(quantity) || quantity < 1) {
    status = 'error';
    errorMessage = 'ערך נקוב לא תקין';
  } else if (!accountId) {
    status = 'error';
    errorMessage = 'מספר חשבון חסר';
  } else if (!stockMap.has(stockId)) {
    if (silencedStockIds.includes(stockId)) {
      status = 'silenced';
    } else {
      status = 'error';
      errorMessage = 'נייר ערך לא מוכר';
    }
  } else if (!accountMap.has(Number(accountId))) {
    status = 'error';
    errorMessage = 'מספר חשבון לא מוכר';
  }

  const processedRecord: HoldingFeedLineWithName = {
    stockId,
    stockName,
    quantity,
    accountId,
    lineNumber,
    status,
    error: errorMessage,
  };
  

  return { processedRecord }
}
