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
import { getPreviousHoldings } from '@/collections/holdings/feeds/FeedDataUtils'
import { containsHebrewText } from '@/collections/holdings/feeds/FeedUtils'

export type HoldingFeedLineWithName = HoldingFeedLine & {
  stockName?: string | null
  companyName?: string | null
}

/**
 * Helper function to convert text quantity values to numbers, handling comma-separated numbers
 * @param results The parsed file content
 * @param hasHebrewHeader Whether the file has a Hebrew header row
 */
const convertQuantityTextToNumbers = (results: Array<any>, hasHebrewHeader: boolean): void => {
  const startIndex = hasHebrewHeader ? 1 : 0

  for (let i = startIndex; i < results.length; i++) {
    const row = results[i]

    if (Array.isArray(row)) {
      // For XLSX files
      const quantity = row[QUANTITY_COL]

      if (typeof quantity === 'string' && quantity.trim() !== '') {
        // Remove commas and convert to number
        const cleanedQuantity = quantity.replace(/,/g, '')
        if (!isNaN(Number(cleanedQuantity))) {
          row[QUANTITY_COL] = Number(cleanedQuantity)
        }
      }
    } else {
      // For CSV files
      const quantity = row[QUANTITY_COL.toString()]

      if (typeof quantity === 'string' && quantity.trim() !== '') {
        // Remove commas and convert to number
        const cleanedQuantity = quantity.replace(/,/g, '')
        if (!isNaN(Number(cleanedQuantity))) {
          row[QUANTITY_COL.toString()] = Number(cleanedQuantity)
        }
      }
    }
  }
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

  // Always convert text quantity values to numbers (handles comma-separated numbers)
  convertQuantityTextToNumbers(results, hasHebrewHeader)

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
 * Initialize company ID to name mapping from user's treeCompanies
 * @param req The payload request
 * @returns Map of company IDs to company names
 */
export const initializeCompanyIdToNameMap = (req: PayloadRequest): Map<string, string> => {
  const companyIdToNameMap = new Map<string, string>()

  if (req.user?.treeCompanies) {
    try {
      const companyTree = JSON.parse(req.user.treeCompanies)

      // Recursively extract company names from the tree structure
      const extractCompanyNames = (companies: any[]) => {
        companies.forEach((company: any) => {
          if (company.id && company.name) {
            companyIdToNameMap.set(company.id, company.name)
          }
          if (company.subCompanies && company.subCompanies.length > 0) {
            extractCompanyNames(company.subCompanies)
          }
        })
      }

      extractCompanyNames(companyTree)
    } catch (error) {
      console.error('Error parsing treeCompanies:', error)
    }
  }

  return companyIdToNameMap
}

/**
 * Group rows by company and create maps for accounts and rows
 * @param companiesWithData Set of company IDs that have data in the feed
 * @param accountIds Array of account IDs in the feed
 * @param standardizedRows Array of standardized rows
 * @param accountToCompanyMap Map of account numbers to company IDs
 * @param selectedCompanies Array of selected company IDs
 * @returns Object containing maps of accounts and rows by company
 */
export const groupRowsByCompany = (
  companiesWithData: Set<string>,
  accountIds: number[],
  standardizedRows: StandardizedRow[],
  accountToCompanyMap: Map<number, string>,
  selectedCompanies: string[],
): {
  currentAccountsByCompany: Map<string, Set<string>>
  currentRowsByCompany: Map<string, StandardizedRow[]>
} => {
  const currentAccountsByCompany = new Map<string, Set<string>>()
  const currentRowsByCompany = new Map<string, StandardizedRow[]>()

  // Initialize empty sets for all companies first
  for (const companyId of companiesWithData) {
    currentRowsByCompany.set(companyId, [])
    currentAccountsByCompany.set(companyId, new Set<string>())
  }

  // Add ALL accounts from accountIds to their respective companies
  accountIds.forEach((accountId) => {
    const companyForAccount = accountToCompanyMap.get(accountId)
    if (companyForAccount && selectedCompanies.includes(companyForAccount)) {
      const accounts = currentAccountsByCompany.get(companyForAccount)
      if (accounts) {
        accounts.add(accountId.toString())
      }
    }
  })

  // Count current rows per company from standardizedRows
  standardizedRows.forEach((row) => {
    const accountId = Number(row.accountId)
    if (!isNaN(accountId)) {
      const companyForAccount = accountToCompanyMap.get(accountId)
      if (companyForAccount && selectedCompanies.includes(companyForAccount)) {
        const rows = currentRowsByCompany.get(companyForAccount)
        if (rows) {
          rows.push(row)
        }
      }
    }
  })

  return { currentAccountsByCompany, currentRowsByCompany }
}

/**
 * Check for duplicate feed for a specific date by company
 * @param req The payload request
 * @param companyId The ID of the company to check
 * @param startValueDate The start of the value date range
 * @param endValueDate The end of the value date range
 * @param valueDate The original value date string
 * @param companyIdToNameMap Map of company IDs to company names
 * @param warnings Array of warnings to append to
 */
export const checkDuplicateFeedForDate = async (
  req: PayloadRequest,
  companyId: string,
  startValueDate: Date,
  endValueDate: Date,
  valueDate: string,
  companyIdToNameMap: Map<string, string>,
  warnings: FeedWarning[],
): Promise<void> => {
  const existingHoldings = await req.payload.find({
    collection: 'holdings',
    select: { fund: true },
    where: {
      valueDate: {
        greater_than_equal: startValueDate.toISOString(),
        less_than_equal: endValueDate.toISOString(),
      },
      fund: {
        equals: companyId,
      },
    },
    depth: 0,
    limit: 1,
  })

  if (existingHoldings.docs.length > 0) {
    const formattedDate = valueDate.split('-').reverse().join('/')
    const companyName = companyIdToNameMap.get(companyId) || companyId
    warnings.push({
      type: 'duplicateFeedForDate',
      message: `בוצעה בעבר הזנה לתאריך ${formattedDate} עבור קרן ${companyName}`,
      count: existingHoldings.docs.length,
      companyId,
    })
  }
}

/**
 * Check for warnings in the feed
 * @param req The payload request
 * @param valueDate The value date
 * @param accountIds The account IDs in the feed
 * @param standardizedRows The standardized rows
 * @param accountToCompanyMap Map of account numbers to company IDs
 * @param selectedCompanies Array of selected company IDs
 * @returns Object containing array of warnings and set of companies with data
 */
export const checkFeedWarnings = async (
  req: PayloadRequest,
  valueDate: string,
  accountIds: number[],
  standardizedRows: StandardizedRow[],
  accountToCompanyMap: Map<number, string>,
  selectedCompanies: string[],
): Promise<{ warnings: FeedWarning[]; companiesWithData: Set<string> }> => {
  const warnings: FeedWarning[] = []

  // Create company ID to name mapping from user's treeCompanies
  const companyIdToNameMap = initializeCompanyIdToNameMap(req)
  const startValueDate = new Date(valueDate)
  startValueDate.setHours(0, 0, 0, 0)
  const endValueDate = new Date(valueDate)
  endValueDate.setHours(23, 59, 59, 999)

  // Get companies that actually have data in the current feed
  const companiesWithData = new Set<string>()
  standardizedRows.forEach((row) => {
    const accountId = Number(row.accountId)
    if (!isNaN(accountId)) {
      const companyForAccount = accountToCompanyMap.get(accountId)
      if (companyForAccount) {
        companiesWithData.add(companyForAccount)
      }
    }
  })
  //Check for companies in selectedCompanies not in the feed
  const missingCompanies = selectedCompanies.filter(
    (companyId) => !companiesWithData.has(companyId),
  )
  if (missingCompanies.length > 0) {
    const missingCompanyNames = missingCompanies.map(
      (companyId) => companyIdToNameMap.get(companyId) || companyId,
    )
    warnings.push({
      type: 'missingCompanyData',
      message: `נבחרו קרנות ללא נתונים בקובץ`,
      details: missingCompanyNames,
      count: missingCompanies.length,
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

  // Group current rows by company
  const { currentAccountsByCompany, currentRowsByCompany } = groupRowsByCompany(
    companiesWithData,
    accountIds,
    standardizedRows,
    accountToCompanyMap,
    selectedCompanies,
  )

  // Compare data for each company
  for (const companyId of companiesWithData) {
    // Check for duplicate feed for date by company (only for companies with data in current feed)
    await checkDuplicateFeedForDate(
      req,
      companyId,
      startValueDate,
      endValueDate,
      valueDate,
      companyIdToNameMap,
      warnings,
    )

    const currentRows = currentRowsByCompany.get(companyId) || []
    const currentAccounts = currentAccountsByCompany.get(companyId) || new Set<string>()
    const currentCount = currentRows.length

    // Get previous holdings for this company
    const previousHolding = await getPreviousHoldings(req, valueDate, companyId)

    if (previousHolding && Object.keys(previousHolding.stats).length > 0) {
      // Get previous stats
      const previousStats = previousHolding.stats || {}
      const previousCount = previousStats.recordCount || 0

      // Parse previous account IDs
      let previousAccountIds: string[] = []
      try {
        if (previousStats.accountIds) {
          const parsed = JSON.parse(previousStats.accountIds as string)
          previousAccountIds = parsed?.length ? parsed.map(String) : []
        }
      } catch (error) {
        console.error(`Error parsing accountIds for company ${companyId}:`, error)
        previousAccountIds = []
      }

      const previousAccounts = new Set<string>(previousAccountIds)
      // Check for line count difference
      const percentDifference =
        previousCount > 0 ? (Math.abs(currentCount - previousCount) / previousCount) * 100 : 0

      if (previousCount > 0 && percentDifference > 5) {
        const companyName = companyIdToNameMap.get(companyId) || companyId
        warnings.push({
          type: 'lineCountDifference',
          message: `חריגה בכמות הרשומות בהשוואה להזנה קודמת עבור קרן ${companyName}`,
          details: [`הזנה קודמת: ${previousCount} שורות`, `הזנה נוכחית: ${currentCount} שורות`],
          companyId,
        })
      }

      // Check for missing accounts
      const missingAccounts = previousAccountIds.filter((account) => !currentAccounts.has(account))

      if (missingAccounts.length > 0) {
        const companyName = companyIdToNameMap.get(companyId) || companyId
        warnings.push({
          type: 'missingAccounts',
          message: `חשבונות חסרים בהשוואה להזנה קודמת עבור קרן ${companyName}`,
          details: missingAccounts,
          count: missingAccounts.length,
          companyId,
        })
      }

      // Check for extra accounts
      const extraAccounts = Array.from(currentAccounts).filter(
        (account) => !previousAccounts.has(account),
      )

      if (extraAccounts.length > 0) {
        const companyName = companyIdToNameMap.get(companyId) || companyId
        warnings.push({
          type: 'extraAccounts',
          message: `נמצאו חשבונות חדשים שלא הופיעו בהזנה הקודמת עבור קרן ${companyName}`,
          details: extraAccounts,
          count: extraAccounts.length,
          companyId,
        })
      }
    }
  }

  return { warnings, companiesWithData }
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
