import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import * as XLSX from 'xlsx'
import { Account, Company, HoldingsFeed, Stock } from '@/payload-types'

// Define column indices for files without headers
// Assuming the columns are in a specific order: stockId, quantity, accountId
const STOCK_ID_COL = 0
const QUANTITY_COL = 1
const ACCOUNT_ID_COL = 2

interface HoldingImport {
  stockId: string
  quantity: number
  accountId: string
  lineNumber: number
  status: 'success' | 'error'
  error?: string
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
  processedRecord: HoldingImport
} => {
  const { stockId, quantity, accountId } = row
  const lineNumber = index + 1

  // Validate the record
  let isValid = true
  let errorMessage = ''

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

  const processedRecord: HoldingImport = {
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
const preloadAccounts = async (
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
    depth: 1,
  })

  const accountMap: Map<number, string> = new Map()
  companies.docs.forEach((company: Company) => {
    const accounts = company?.accounts?.docs as Account[]
    accounts.forEach((account) => {
      accountMap.set(account?.accountNumber, account?.id)
      account?.accounts?.docs?.forEach((value) => {
        const subAccount: Account = value as Account
        accountMap.set(subAccount.accountNumber, account?.id)
      })
    })
  })

  return accountMap
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
      stockMap.set(stock?.stockId, stock?.relatedStock ? stock.relatedStock as string: stock?.id )
  })

  return stockMap
}

/**
 * Collect previous feed data for comparison
 * @param req The payload request
 * @param valueDate The current value date
 * @param accounts
 * @returns Previous accounts and feed date
 */
const collectPreviousFeedData = async (
  req: PayloadRequest,
  valueDate: string,
  accounts: number[],
): Promise<{
  previousAccounts: Set<string>
  previousFeedDate: string | null
}> => {
  const previousFeedDate = await getPreviousFeedDate(req, valueDate, accounts)
  const previousAccounts = new Set<string>()

  if (previousFeedDate) {
    const previousHoldings = await req.payload.find({
      collection: 'holdings',
      where: {
        valueDate: {
          equals: previousFeedDate,
        },
        accountNumber: {
          in: accounts,
        },
      },
      depth: 0,
      limit: 1000,
    })

    previousHoldings.docs.forEach((holding) => {
      if (holding.account) {
        previousAccounts.add(holding.account as string)
      }
    })
  }

  return { previousAccounts, previousFeedDate }
}

/**
 * Create holdings from processed records
 * @param req The payload request
 * @param processedRecords The processed records
 * @param accountMap
 * @param stockMap
 * @param valueDate The value date
 */
const createHoldings = async (
  req: PayloadRequest,
  processedRecords: HoldingImport[],
  accountMap: Map<number, string>,
  stockMap: Map<string, string>,
  valueDate: string,
): Promise<void> => {
  // Aggregate records with the same accountId and stockId
  const aggregatedRecords = new Map<string, { account: string, stock: string, quantity: number }>();

  for (const record of processedRecords) {
    if (record.status === 'success') {
      const accountId = parseInt(record.accountId);
      const account = accountMap.get(accountId) as string;
      const stock = stockMap.get(record.stockId) as string;

      // Create a unique key for each account-stock combination
      const key = `${account}-${stock}`;

      if (aggregatedRecords.has(key)) {
        // If this combination already exists, add to the quantity
        const existingRecord = aggregatedRecords.get(key)!;
        existingRecord.quantity += record.quantity;
      } else {
        // Otherwise, create a new entry
        aggregatedRecords.set(key, {
          account,
          stock,
          quantity: record.quantity
        });
      }
    }
  }

  // Create holdings from the aggregated records
  for (const [_, record] of aggregatedRecords) {
    try {
      await req.payload.create({
        collection: 'holdings',
        data: {
          account: record.account,
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
 * Update document status
 * @param req The payload request
 * @param docId The document ID
 * @param status The status to set
 * @param errors Optional errors to include
 * @param accountsJson Optional JSON string of accounts
 */
const updateDocumentStatus = async (
  req: PayloadRequest,
  docId: string,
  status: 'completed' | 'failed',
  errors?: any[],
  accountsJson?: string,
): Promise<void> => {
  const data: any = {
    processingStatus: status,
  }

  if (errors && errors.length > 0) {
    data.processingErrors = errors
  }

  if (accountsJson) {
    data.accountsJson = accountsJson
  }

  await req.payload.update({
    collection: 'holdings-feed' as any,
    id: docId,
    data,
  })
}

/**
 * Check for feed data anomalies
 * @param req The payload request
 * @param previousAccounts Previous accounts
 * @param currentAccounts Current accounts
 * @param previousFeedDate Previous feed date
 * @param currentCount Current record count
 */
const checkFeedDataAnomalies = (
  req: PayloadRequest,
  previousAccounts: Set<string>,
  currentAccounts: Set<string>,
  previousFeedDate: string | null,
  currentCount: number,
): void => {
  // Check for missing accounts compared to previous feed
  const missingAccounts = [...previousAccounts].filter((id) => !currentAccounts.has(id))

  if (missingAccounts.length > 0) {
    req.payload.logger.warn(`Missing ${missingAccounts.length} accounts compared to previous feed`)
  }

  // Check if the number of records is significantly different from previous feed
  if (previousFeedDate) {
    const previousCount = previousAccounts.size
    const percentDifference = (Math.abs(currentCount - previousCount) / previousCount) * 100

    if (percentDifference > 5) {
      req.payload.logger.warn(
        `Line count differs by more than 5% from previous feed: ${percentDifference.toFixed(2)}%`,
      )
    }
  }
}

async function checkPreviousHoldings(req: PayloadRequest, valueDate: string, accountIds: number[]) {
  // Check for existing holdings on the same date
  const existingHoldings = await req.payload.find({
    collection: 'holdings',
    where: {
      valueDate: {
        equals: valueDate,
      },
      account: {
        in: accountIds,
      },
    },
  })

  if (existingHoldings.docs.length > 0) {
    // This should be handled by the UI with a confirmation prompt
    req.payload.logger.warn(
      `Found ${existingHoldings.docs.length} existing holdings for date ${valueDate}`,
    )
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
  doc: HoldingsFeed,
): Promise<void> => {
  try {
    // Initial validation
    // Get the file from the request
    const file = req.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      return
    }

    // Get the value date from the document
    const valueDate = doc.valueDate
    if (!valueDate) {
      await updateDocumentStatus(req, doc.id, 'failed', [{ error: 'Missing value date' }])
      return
    }

    // Check user permissions //TODO check that companies are subset of user leaf companies
    if (!req.user) {
      await updateDocumentStatus(req, doc.id, 'failed', [{ error: 'User not authenticated' }])
      return
    }

    // File conversion to JSON
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      await updateDocumentStatus(req, doc.id, 'failed', [
        { error: `Unsupported file format: ${fileExt}` },
      ])
      return
    }

    // Parse the file content
    const results = parseFileContent(file)

    // Process records
    const processedRecords: HoldingImport[] = []
    const errors: any[] = []

    // Preload accounts
    const accountMap = await preloadAccounts(req, doc.selectedCompanies as string[])

    // Standardize the JSON to be in standard format for both CSV and Excel
    const standardizedRows = standardizeRows(results)

    // Preload stocks
    const stockMap = await preloadStocks(req, standardizedRows)

    //TODO consider if we need to warn in the output as well ?//TODO Implement properly
    //    await checkPreviousHoldings(req, valueDate, Array.from(accountMap.keys()))
    // Collect previous feed data for comparison //TODO Implement properly
    //    const { previousAccounts, previousFeedDate } = await collectPreviousFeedData(req, valueDate, Array.from(accountMap.keys()))

    // Process each standardized row
    standardizedRows.forEach((row, index) => {
      const { processedRecord } = validateRow(row, index, accountMap, stockMap)
      processedRecords.push(processedRecord)
    })

    // Check for feed data anomalies //TODO Reimplement
    //checkFeedDataAnomalies(req, previousAccounts, currentAccounts, previousFeedDate, results.length)

    // If there are errors, update the document with the errors
    //TODO not sure it's needed if there are errors we insert what's valid
    /*    if (errors.length > 0) {
          await updateDocumentStatus(req, doc.id, 'failed', errors)
          return
        }*/

    // Delete existing holdings for the date TODO pass also the meetings
    await deleteExistingHoldings(req, valueDate, Array.from(accountMap.keys()))

    // Create holdings
    await createHoldings(req, processedRecords, accountMap, stockMap, valueDate)

    // Collect all unique account IDs from the standardized rows
    const uniqueAccountIds = Array.from(
      new Set(
        standardizedRows
          .map((row) => Number(row.accountId))
          .filter((accountId) => !isNaN(accountId)),
      ),
    )

    // Convert the account IDs to a JSON string
    const accountsJson = JSON.stringify(uniqueAccountIds)

    // Get the previous feed's accounts JSON
    const previousAccountsJson = await getPreviousFeedAccountsJson(
      req,
      valueDate,
      doc.selectedCompanies as string[],
    )

    // Compare the current feed's accounts with the previous feed's accounts
    compareAccountsWithPreviousFeed(req, uniqueAccountIds, previousAccountsJson)

    // Update the document status and store the accounts JSON
    await updateDocumentStatus(req, doc.id, 'completed', undefined, accountsJson)

    req.payload.logger.info(
      `Successfully processed ${processedRecords.length} holdings for date ${valueDate}`,
    )
  } catch (error) {
    req.payload.logger.error(`Error processing holdings feed: ${JSON.stringify(error)}`)

    // Update the document status
    await updateDocumentStatus(req, doc.id, 'failed', [
      { error: `General processing error: ${error}` },
    ])
  }
}

// Helper function to delete existing holdings for a date
async function deleteExistingHoldings(
  req: PayloadRequest,
  valueDate: string,
  accounts: number[],
): Promise<void> {
  await req.payload.delete({
    collection: 'holdings',
    where: {
      valueDate: {
        equals: valueDate,
      },
      accountNumber: {
        in: accounts,
      },
    },
  })
}

// Helper function to get the date of the most recent holdings feed
async function getPreviousFeedDate(
  req: PayloadRequest,
  currentDate: string,
  accounts: number[],
): Promise<string | null> {
  const holdings = await req.payload.find({
    collection: 'holdings',
    where: {
      valueDate: {
        less_than: currentDate,
      },
      accountNumber: {
        in: accounts,
      },
    },
    sort: '-valueDate',
    depth: 0,
    limit: 1,
  })

  if (holdings.docs.length > 0) {
    return holdings.docs[0].valueDate as string
  }

  return null
}

/**
 * Get the accounts JSON from the most recent feed before the current one
 * @param req The payload request
 * @param currentDate The current feed date
 * @param companies
 * @returns The accounts JSON from the previous feed, or null if no previous feed exists
 */
async function getPreviousFeedAccountsJson(
  req: PayloadRequest,
  currentDate: string,
  companies: string[],
): Promise<string | null> {
  const previousFeed = await req.payload.find({
    collection: 'holdings-feed',
    where: {
      valueDate: {
        less_than: currentDate,
      },
      processingStatus: {
        equals: 'completed',
      },
      companies: {
        in: companies,
      },
    },
    sort: '-valueDate',
    depth: 0,
    limit: 1,
  })

  if (previousFeed.docs.length > 0 && previousFeed.docs[0].accountsJson) {
    return previousFeed.docs[0].accountsJson as string
  }

  return null
}

/**
 * Compare the current feed's accounts with the previous feed's accounts
 * @param req The payload request
 * @param currentAccounts The current feed's accounts
 * @param previousAccountsJson The previous feed's accounts JSON
 */
function compareAccountsWithPreviousFeed(
  req: PayloadRequest,
  currentAccounts: number[],
  previousAccountsJson: string | null,
): void {
  if (!previousAccountsJson) {
    req.payload.logger.info('No previous feed found for comparison')
    return
  }

  try {
    const previousAccounts = JSON.parse(previousAccountsJson)

    // Find accounts that are in the previous feed but not in the current feed
    const missingAccounts = previousAccounts.filter(
      (account: number) => !currentAccounts.includes(account),
    )

    // Find accounts that are in the current feed but not in the previous feed
    const newAccounts = currentAccounts.filter(
      (account: number) => !previousAccounts.includes(account),
    )

    if (missingAccounts.length > 0) {
      req.payload.logger.warn(
        `Missing ${missingAccounts.length} accounts compared to previous feed: ${JSON.stringify(missingAccounts)}`,
      )
    }

    if (newAccounts.length > 0) {
      req.payload.logger.info(
        `Found ${newAccounts.length} new accounts compared to previous feed: ${JSON.stringify(newAccounts)}`,
      )
    }

    // Log the total number of accounts in both feeds
    req.payload.logger.info(
      `Previous feed had ${previousAccounts.length} accounts, current feed has ${currentAccounts.length} accounts`,
    )
  } catch (error) {
    req.payload.logger.error(
      `Error comparing accounts with previous feed: ${JSON.stringify(error)}`,
    )
  }
}
