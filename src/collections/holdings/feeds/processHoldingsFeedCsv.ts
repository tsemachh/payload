import { PayloadRequest } from 'payload'
import { HoldingFeedLine, HoldingsFeed } from '@/payload-types'
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes'
import {
  checkFeedWarnings,
  validateRow,
  validateWholeFeed,
} from '@/collections/holdings/feeds/FeedValidations'
import { parseFileContent, standardizeRows } from '@/collections/holdings/feeds/FeedUtils'
import {
  createHoldings,
  deleteExistingHoldings,
  fetchAllSilencedStocks,
  preloadAccountsToCompanyMap,
  preloadStocks,
} from '@/collections/holdings/feeds/FeedDataUtils'

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
    const validationResult: FeedValidationResult = {
      fatalErrors: [],
      warnings: [],
      recordErrors: [],
      validRecords: [],
      silencedRecords: [],
    }
    req.payload.logger.info('Starting holdings feed processing')
    // Initial validation
    // Get the file from the request

    const file = req.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'No file found in request',
      })
      return validationResult
    }

    const valueDate = doc.valueDate
    if (!valueDate) {
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'Missing value date',
      })
      return validationResult
    }

    if (!req.user) {
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'User not authenticated',
      })
      return validationResult
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      validationResult.fatalErrors.push({
        type: 'other',
        message: `Unsupported file format: ${fileExt}`,
      })
      return validationResult
    }

    const results = parseFileContent(file) ?? []

    // Validate the whole feed
    const { fatalErrors, headerWarning } = validateWholeFeed(results)

    if (fatalErrors.length > 0) {
      validationResult.fatalErrors = fatalErrors
      return validationResult
    }

    // Add the header warning if present and skip the first row if it's a Hebrew header
    if (headerWarning) {
      validationResult.warnings.push(headerWarning)

      // Skip the first row if it's a Hebrew header
      if (results.length > 0) {
        results.shift()
      }
    }

    // Preload accounts
    const { accountToCompanyMapI: accountToCompanyMap, accountNameMap } =
      await preloadAccountsToCompanyMap(req, doc.selectedCompanies as string[])

    // Standardize the JSON to be in standard format for both CSV and Excel
    const standardizedRows = standardizeRows(results)

    // Preload stocks
    const stocksMap = await preloadStocks(req, standardizedRows)

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

    const allSilencedStocks = await fetchAllSilencedStocks(req, doc.selectedCompanies as string[])
    const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId)

    const processedRecords: HoldingFeedLine[] = []

    for (const [index, row] of standardizedRows.entries()) {
      const { processedRecord } = await validateRow(
        row,
        index,
        accountToCompanyMap,
        stocksMap,
        accountNameMap,
        silencedStockIds,
      )

      processedRecords.push(processedRecord)

      if (processedRecord.status === 'error') {
        validationResult.recordErrors.push(processedRecord)
      } else if (processedRecord.status === 'success') {
        validationResult.validRecords.push(processedRecord)
      } else validationResult.silencedRecords.push(processedRecord)
    }

    const lineErrors = processedRecords.map((item) => {
      return { line: item as HoldingFeedLine }
    })

    doc.processingResults = [...lineErrors]
    doc.accountsJson = JSON.stringify(uniqueAccountIds)

    if (validateOnly) {
      return validationResult
    }

    // If we're here, this is a save request
    // Delete existing holdings for the date if they exist
    if (warnings.some((w) => w.type === 'duplicateFeedForDate')) {
      deleteExistingHoldings(req, valueDate, doc.selectedCompanies as string[])
    }

    //Create the holding feed
    await req.payload.create({
      collection: 'holdings-feed',
      data: doc as HoldingsFeed,
      file: file,
      req,
    })

    // Create holdings
    await createHoldings(req, processedRecords, accountToCompanyMap, stocksMap, valueDate)

    return validationResult
  } catch (error) {
    req.payload.logger.error(`Error processing holdings feed: ${JSON.stringify(error)}`)
    throw error
  }
}
