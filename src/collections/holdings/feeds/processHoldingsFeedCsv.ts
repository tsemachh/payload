import { PayloadRequest } from 'payload'
import { HoldingFeedLine, HoldingsFeed } from '@/payload-types'
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes'
import { checkFeedWarnings, validateRow, validateWholeFeed } from '@/collections/holdings/feeds/FeedValidations'
import { parseFileContent, standardizeRows } from '@/collections/holdings/feeds/FeedUtils'
import {
  createHoldings,
  deleteExistingHoldings,
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
    // Initialize validation result
    const validationResult: FeedValidationResult = {
      fatalErrors: [],
      warnings: [],
      recordErrors: [],
      validRecords: [],
    }
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

    // Get the value date from the document
    const valueDate = doc.valueDate
    if (!valueDate) {
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'Missing value date',
      })
      return validationResult
    }

    // Check user permissions //TODO check that companies are subset of user leaf companies
    if (!req.user) {
      validationResult.fatalErrors.push({
        type: 'other',
        message: 'User not authenticated',
      })
      return validationResult
    }

    // File conversion to JSON
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      validationResult.fatalErrors.push({
        type: 'other',
        message: `Unsupported file format: ${fileExt}`,
      })
      return validationResult
    }

    // Parse the file content
    const results = parseFileContent(file).filter(row => row.length > 0);

    // Validate the whole feed
    const fatalErrors = validateWholeFeed(results)
    if (fatalErrors.length > 0) {
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
    doc.processingResults = [...lineErrors]
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

