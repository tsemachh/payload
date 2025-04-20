import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import * as XLSX from 'xlsx'
import { Account, Company, HoldingFeedLine, HoldingsFeed, Stock } from '@/payload-types'

// Define validation types
export interface FeedValidationResult {
  isValid: boolean
  fatalErrors: FeedFatalError[]
  warnings: FeedWarning[]
  recordErrors: HoldingFeedLine[]
  validRecords: HoldingFeedLine[]
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

// Define column indices for files without headers
// Assuming the columns are in a specific order: stockId, quantity, accountId
const STOCK_ID_COL = 0
const QUANTITY_COL = 1
const ACCOUNT_ID_COL = 2

/**
 * Validate the whole feed for fatal errors
 * @param results The parsed file content
 * @returns Array of fatal errors
 */
const validateWholeFeed = (results: Array<any>): FeedFatalError[] => {
  const fatalErrors: FeedFatalError[] = []

  // Check if file is empty
  if (!results || results.length === 0) {
    fatalErrors.push({
      type: 'emptyFile',
      message: 'הקובץ שהוזן ריק - הזנתו לא התקבלה',
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
      message: 'פורמט הקובץ שהוזן שגוי - הזנתו לא התקבלה',
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
const checkFeedWarnings = async (
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
      valueDate: {
        equals: valueDate,
      },
      selectedCompanies: {
        equals: selectedCompanies as string[],
      },
    },
  })
  if (existingHoldings.docs.length > 0) {
    warnings.push({
      type: 'duplicateFeedForDate',
      message: `כבר קיימת הזנה לתאריך ${valueDate}`,
      count: existingHoldings.docs.length,
    })
  }

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
    const previousCount = previousFeed.processingErrors?.length || 0
    const currentCount = standardizedRows.length
    const percentDifference =
      previousCount > 0 ? (Math.abs(currentCount - previousCount) / previousCount) * 100 : 0

    if (percentDifference > 5) {
      warnings.push({
        type: 'lineCountDifference',
        message: `פער של מעל 5% בכמות השורות (${percentDifference.toFixed(2)}%)`,
        details: [`הזנה קודמת: ${previousCount} שורות`, `הזנה נוכחית: ${currentCount} שורות`],
      })
    }

    const currentAccounts = new Set<string>(accountIds.map((id) => id.toString()))
    const previousAccounts = JSON.parse(previousFeed.accountsJson as string)

    const missingAccounts = [...previousAccounts].filter((account) => !currentAccounts.has(account))
    if (missingAccounts.length > 0) {
      warnings.push({
        type: 'missingAccounts',
        message: 'חשבונות חסרים בהשוואה להזנה קודמת',
        details: missingAccounts,
        count: missingAccounts.length,
      })
    }
  }

  return warnings
}

interface StandardizedRow {
  stockId: string
  quantity: number
  accountId: string
}

/**
 * Parse file content based on file extension
 * @param file The file to parse
 * @returns Parsed file content as an array
 */
const parseFileContent = (file: any): any[] => {
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  let results: any[] = []

  if (fileExt === 'csv') {
    const csvData = file.data.toString('utf8')
    // Parse CSV without using generateHeaderNames which can cause errors
    results = csvToJson.fieldDelimiter(',').csvStringToJson(csvData)
  } else if (fileExt === 'xlsx' || fileExt === 'xls') {
    const workbook = XLSX.read(file.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    // Use header: 1 option to handle XLSX without headers
    results = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  }

  return results
}

/**
 * Standardize row data from different file formats
 * @param results The parsed file content
 * @returns Array of standardized rows
 */
const standardizeRows = (results: any[]): StandardizedRow[] => {
  const standardizedRows: StandardizedRow[] = []

  results.forEach((row) => {
    if (Array.isArray(row)) {
      // For XLSX files with header: 1 option, row is an array
      standardizedRows.push({
        stockId: row[STOCK_ID_COL]?.toString() || '',
        quantity: parseFloat(row[QUANTITY_COL]?.toString() || '0'),
        accountId: row[ACCOUNT_ID_COL]?.toString() || '',
      })
    } else {
      // For CSV files, row is an object with keys from the first row
      standardizedRows.push({
        stockId: row[STOCK_ID_COL.toString()]?.toString() || '',
        quantity: parseFloat(row[QUANTITY_COL.toString()]?.toString() || '0'),
        accountId: row[ACCOUNT_ID_COL.toString()]?.toString() || '',
      })
    }
  })

  return standardizedRows
}

/**
 * Validate a single row
 * @param row The row to validate
 * @param index The index of the row
 * @param accountMap
 * @param stockMap
 * @returns Validation result
 */
const validateRow = (
  row: StandardizedRow,
  index: number,
  accountMap: Map<number, string>,
  stockMap: Map<string, string>,
): {
  processedRecord: HoldingFeedLine
} => {
  const { stockId, quantity, accountId } = row
  const lineNumber = index + 1

  // Validate the record
  let isValid = true
  let errorMessage = null

  // Check required fields
  if (!stockId) {
    isValid = false
    errorMessage = 'Missing stock ID'
  } else if (isNaN(quantity) || quantity < 1) {
    isValid = false
    errorMessage = 'Invalid quantity: must be a positive number >= 1'
  } else if (!accountId) {
    isValid = false
    errorMessage = 'Missing account ID'
  } else if (!stockMap.has(stockId)) {
    isValid = false
    errorMessage = 'Unknown stock ID'
  } else if (!accountMap.has(Number(accountId))) {
    isValid = false
    errorMessage = 'Unknown account ID'
  }

  const processedRecord: HoldingFeedLine = {
    stockId,
    quantity,
    accountId,
    lineNumber,
    status: isValid ? 'success' : 'error',
    error: errorMessage,
  }

  return { processedRecord }
}

/**
 * Preload accounts from companies
 * @param req The payload request
 * @param selectedCompanies The selected companies
 * @returns Map of account numbers to account IDs
 */
const preloadAccountsToCompanyMap = async (
  req: PayloadRequest,
  selectedCompanies: string[],
): Promise<Map<number, string>> => {
  const companies = await req.payload.find({
    collection: 'companies',
    where: {
      id: {
        in: selectedCompanies,
      },
    },
    limit: 0,
    depth: 2,
  })

  const accountToCompanyMap: Map<number, string> = new Map()
  console.log('Processing companies:', companies.docs.length)

  companies.docs.forEach((company: Company) => {
    console.log(
      'Processing company:',
      company.id,
      'Accounts:',
      company?.accounts?.docs?.length ?? 0,
    )
    const accounts = company?.accounts?.docs as Account[]

    accounts.forEach((account) => {
      console.log('Processing account:', account?.accountNumber, 'ID:', account?.id)
      accountToCompanyMap.set(account?.accountNumber, company?.id)

      if (!account?.accounts?.docs || account?.accounts?.docs.length === 0) {
        console.log('No sub-accounts found for account:', account?.accountNumber)
      }

      account?.accounts?.docs?.forEach((subAccount) => {
        const subAcc = subAccount as Account
        accountToCompanyMap.set(subAcc.accountNumber, company?.id)
      })
    })
  })
  console.log('Final accountToCompanyMap:', Array.from(accountToCompanyMap.entries()))

  return accountToCompanyMap
}

/**
 * Preload stocks from stock IDs
 * @param req The payload request
 * @param standardizedRows
 * @returns Map of stock IDs to stock documents
 */
const preloadStocks = async (
  req: PayloadRequest,
  standardizedRows: StandardizedRow[],
): Promise<Map<string, string>> => {
  const feedStocks: string[] = standardizedRows
    .map((row) => row.stockId)
    .filter((stockId) => stockId !== '')

  const stockMap: Map<string, string> = new Map()
  const stocksResult = await req.payload.find({
    collection: 'stocks',
    where: {
      stockId: {
        in: feedStocks,
      },
    },
    depth: 0,
  })

  stocksResult.docs.forEach((stock: Stock) => {
    // Ensure related.docs exists and check if it's not empty
    const hasRelatedDocs = stock?.relations?.docs && stock.relations.docs.length > 0
    const stockKey = stock?.stockId
    const stockValue =
      stock?.relatedStock && hasRelatedDocs ? (stock.relatedStock as string) : stock?.id
    stockMap.set(stockKey, stockValue)
  })

  console.log('Final stockMap:', Array.from(stockMap.entries()))

  return stockMap
}

/**
 * Create holdings from processed records
 * @param req The payload request
 * @param processedRecords The processed records
 * @param accountToCompanyMap
 * @param stockMap
 * @param valueDate The value date
 */
const createHoldings = async (
  req: PayloadRequest,
  processedRecords: HoldingFeedLine[],
  accountToCompanyMap: Map<number, string>,
  stockMap: Map<string, string>,
  valueDate: string,
): Promise<void> => {
  // Aggregate records with the same accountId and stockId
  const aggregatedRecords = new Map<string, { company: string; stock: string; quantity: number }>()

  for (const record of processedRecords) {
    if (record.status === 'success') {
      const accountId = parseInt(record.accountId as string)
      const company = accountToCompanyMap.get(accountId) as string
      const stock = stockMap.get(record.stockId as string) as string

      // Create a unique key for each account-stock combination
      const key = `${company}-${stock}`

      if (aggregatedRecords.has(key)) {
        // If this combination already exists, add to the quantity
        const existingRecord = aggregatedRecords.get(key)!
        existingRecord.quantity += record.quantity as number
      } else {
        // Otherwise, create a new entry
        aggregatedRecords.set(key, {
          company,
          stock,
          quantity: record.quantity as number,
        })
      }
    }
  }

  // Create holdings from the aggregated records
  for (const [_, record] of aggregatedRecords) {
    try {
      await req.payload.create({
        collection: 'holdings',
        data: {
          company: record.company,
          stock: record.stock,
          quantity: record.quantity,
          valueDate,
        },
      })
    } catch (error) {
      req.payload.logger.error(`Error creating holding: ${JSON.stringify(error)}`)
    }
  }
}

/**
 * Process holdings feed CSV or XLSX file
 *
 * Note: This function assumes that both CSV and XLSX files are without headers
 * and have columns in the following order:
 * Column 0: Stock ID
 * Column 1: Quantity
 * Column 2: Account ID
 */
export const processHoldingsFeedCsv = async (
  req: PayloadRequest,
  doc: Partial<HoldingsFeed>,
  validateOnly: boolean = false,
): Promise<FeedValidationResult | undefined> => {
  try {
    // Initialize validation result
    const validationResult: FeedValidationResult = {
      isValid: true,
      fatalErrors: [],
      warnings: [],
      recordErrors: [],
      validRecords: [],
    }
    // Initial validation
    // Get the file from the request
    debugger
    const file = req.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      validationResult.isValid = false
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'No file found in request',
      })
      return validationResult
    }

    // Get the value date from the document
    const valueDate = doc.valueDate
    if (!valueDate) {
      validationResult.isValid = false
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'Missing value date',
      })
      return validationResult
    }

    // Check user permissions //TODO check that companies are subset of user leaf companies
    if (!req.user) {
      validationResult.isValid = false
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'User not authenticated',
      })
      return validationResult
    }

    // File conversion to JSON
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      validationResult.isValid = false
      validationResult.fatalErrors.push({
        type: 'other',
        message: `Unsupported file format: ${fileExt}`,
      })
      return validationResult
    }

    // Parse the file content
    const results = parseFileContent(file)

    // Validate the whole feed
    const fatalErrors = validateWholeFeed(results)
    if (fatalErrors.length > 0) {
      validationResult.isValid = false
      validationResult.fatalErrors = fatalErrors
      return validationResult
    }

    // Preload accounts
    const accountToCompanyMap = await preloadAccountsToCompanyMap(
      req,
      doc.selectedCompanies as string[],
    )

    // Standardize the JSON to be in standard format for both CSV and Excel
    const standardizedRows = standardizeRows(results)

    // Preload stocks
    const stockMap = await preloadStocks(req, standardizedRows)

    // Collect all unique account IDs from the standardized rows
    const uniqueAccountIds = Array.from(
      new Set(
        standardizedRows
          .map((row) => Number(row.accountId))
          .filter((accountId) => !isNaN(accountId)),
      ),
    )

    // Check for warnings
    const warnings = await checkFeedWarnings(
      req,
      valueDate,
      uniqueAccountIds,
      standardizedRows,
      accountToCompanyMap,
      doc.selectedCompanies as string[],
    )
    validationResult.warnings = warnings

    // Process each standardized row
    const processedRecords: HoldingFeedLine[] = []
    standardizedRows.forEach((row, index) => {
      const { processedRecord } = validateRow(row, index, accountToCompanyMap, stockMap)
      processedRecords.push(processedRecord)

      if (processedRecord.status === 'error') {
        validationResult.recordErrors.push(processedRecord)
      } else {
        validationResult.validRecords.push(processedRecord)
      }
    })

    // Store validation results in the document
    const lineErrors = processedRecords.map((item) => {
      return { line: item as HoldingFeedLine }
    })

    // Combine line errors and feed errors
    doc.processingErrors = [...lineErrors]
    doc.accountsJson = JSON.stringify(uniqueAccountIds)

    // If this is a validation-only request, update the document and return
    if (validateOnly) {
      req.payload.logger.info(
        `Successfully validated ${processedRecords.length} holdings for date ${valueDate}`,
      )

      return validationResult
    }

    // If we're here, this is a save request
    // Delete existing holdings for the date if they exist
    if (warnings.some((w) => w.type === 'duplicateFeedForDate')) {
      await deleteExistingHoldings(req, valueDate, doc.selectedCompanies as string[])
    }

    //Create the holding feed
    await req.payload.create({
      collection: 'holdings-feed',
      data: doc as HoldingsFeed,
      file: file
    })

    // Create holdings
    await createHoldings(req, processedRecords, accountToCompanyMap, stockMap, valueDate)

    req.payload.logger.info(
      `Successfully processed ${processedRecords.length} holdings for date ${valueDate}`,
    )

    return validationResult
  } catch (error) {
    req.payload.logger.error(`Error processing holdings feed: ${JSON.stringify(error)}`)
    throw error
  }
}

// Helper function to delete existing holdings for a date
async function deleteExistingHoldings(
  req: PayloadRequest,
  valueDate: string,
  companies: string[],
): Promise<void> {
  await req.payload.delete({
    collection: 'holdings',
    where: {
      valueDate: {
        equals: valueDate,
      },
      company: {
        in: companies,
      },
    },
  })

  await req.payload.delete({
    collection: 'holdings-feed',
    where: {
      valueDate: {
        equals: valueDate,
      },
      selectedCompanies: {
        equals: companies,
      },
    },
  })
}

// Helper function to get the date of the most recent holdings feed
async function getPreviousFeed(
  req: PayloadRequest,
  currentDate: string,
  selectedCompanies: string[],
): Promise<HoldingsFeed | null> {
  const holdings = await req.payload.find({
    collection: 'holdings-feed',
    where: {
      valueDate: {
        less_than: currentDate,
      },
      selectedCompanies: {
        equals: selectedCompanies,
      },
    },
    sort: '-valueDate',
    depth: 0,
    limit: 1,
  })

  if (holdings.docs.length > 0) {
    return holdings.docs[0]
  }

  return null
}
