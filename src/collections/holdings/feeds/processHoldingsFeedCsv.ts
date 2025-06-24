import { PayloadRequest } from 'payload'
import { HoldingFeedLine, HoldingsFeed } from '@/payload-types'
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes'
import {
  checkFeedWarnings,
  validateRow,
  validateWholeFeed,
} from '@/collections/holdings/feeds/FeedValidations'
import { parseFileContent, standardizeRows } from '@/collections/holdings/feeds/FeedUtils'
import { performance } from 'perf_hooks'
import {
  createHoldings,
  deleteExistingHoldings,
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
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
  const processStartTime = performance.now()
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

    const parseStartTime = performance.now()
    const results = parseFileContent(file) ?? []
    const parseEndTime = performance.now()
    req.payload.logger.info(
      `File parsing completed in ${parseEndTime - parseStartTime}ms, found ${results.length} rows`,
    )

    // Validate the whole feed
    const validateStartTime = performance.now()
    const fatalErrors = validateWholeFeed(results)
    const validateEndTime = performance.now()
    req.payload.logger.info(`Feed validation completed in ${validateEndTime - validateStartTime}ms`)

    if (fatalErrors.length > 0) {
      validationResult.fatalErrors = fatalErrors
      const processEndTime = performance.now()
      req.payload.logger.info(
        `Process aborted due to fatal errors after ${processEndTime - processStartTime}ms`,
      )
      return validationResult
    }

    // Preload accounts
    const accountStartTime = performance.now()
    const { accountToCompanyMapI: accountToCompanyMap, accountNameMap } =
      await preloadAccountsToCompanyMap(req, doc.selectedCompanies as string[])
    const accountEndTime = performance.now()
    req.payload.logger.info(
      `Account preloading completed in ${accountEndTime - accountStartTime}ms, found ${accountToCompanyMap.size} accounts`,
    )

    // Standardize the JSON to be in standard format for both CSV and Excel
    const standardizeStartTime = performance.now()
    const standardizedRows = standardizeRows(results)
    const standardizeEndTime = performance.now()
    req.payload.logger.info(
      `Row standardization completed in ${standardizeEndTime - standardizeStartTime}ms`,
    )

    // Preload stocks
    const stockStartTime = performance.now()
    const {
      stockIdMap: stockMap,
      stockNameMap,
      stockActiveMap,
    } = await preloadStocks(req, standardizedRows)
    const stockEndTime = performance.now()
    req.payload.logger.info(
      `Stock preloading completed in ${stockEndTime - stockStartTime}ms, found ${stockMap.size} stocks`,
    )

    const uniqueAccountIds = Array.from(
      new Set(
        standardizedRows
          .map((row) => Number(row.accountId))
          .filter((accountId) => !isNaN(accountId)),
      ),
    )

    // Check for warnings
    const warningsStartTime = performance.now()
    const warnings = await checkFeedWarnings(
      req,
      valueDate,
      uniqueAccountIds,
      standardizedRows,
      accountToCompanyMap,
      doc.selectedCompanies as string[],
    )
    const warningsEndTime = performance.now()
    req.payload.logger.info(
      `Feed warnings check completed in ${warningsEndTime - warningsStartTime}ms, found ${warnings.length} warnings`,
    )
    validationResult.warnings = warnings

    const silencedStartTime = performance.now()
    const allSilencedStocks = await fetchAllSilencedStocks(req, doc.selectedCompanies as string[])
    const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId)
    const silencedEndTime = performance.now()
    req.payload.logger.info(
      `Silenced stocks fetching completed in ${silencedEndTime - silencedStartTime}ms, found ${silencedStockIds.length} silenced stocks`,
    )

    const processedRecords: HoldingFeedLine[] = []

    const rowValidationStartTime = performance.now()
    for (const [index, row] of standardizedRows.entries()) {
      const { processedRecord } = await validateRow(
        row,
        index,
        accountToCompanyMap,
        stockMap,
        stockNameMap,
        accountNameMap,
        stockActiveMap,
        silencedStockIds,
      )

      processedRecords.push(processedRecord)

      if (processedRecord.status === 'error') {
        validationResult.recordErrors.push(processedRecord)
      } else if (processedRecord.status === 'success') {
        validationResult.validRecords.push(processedRecord)
      } else validationResult.silencedRecords.push(processedRecord)
    }
    const rowValidationEndTime = performance.now()
    req.payload.logger.info(
      `Row validation completed in ${rowValidationEndTime - rowValidationStartTime}ms`,
    )
    req.payload.logger.info(
      `Validation results: ${validationResult.validRecords.length} valid records, ${validationResult.recordErrors.length} errors, ${validationResult.silencedRecords.length} silenced`,
    )

    const lineErrors = processedRecords.map((item) => {
      return { line: item as HoldingFeedLine }
    })

    doc.processingResults = [...lineErrors]
    doc.accountsJson = JSON.stringify(uniqueAccountIds)

    if (validateOnly) {
      const processEndTime = performance.now()
      req.payload.logger.info(
        `Successfully validated ${processedRecords.length} holdings for date ${valueDate} in ${processEndTime - processStartTime}ms`,
      )

      return validationResult
    }

    // If we're here, this is a save request
    // Delete existing holdings for the date if they exist
    if (warnings.some((w) => w.type === 'duplicateFeedForDate')) {
      const deleteStartTime = performance.now()
      await deleteExistingHoldings(req, valueDate, doc.selectedCompanies as string[])
      const deleteEndTime = performance.now()
      req.payload.logger.info(`Deleted existing holdings in ${deleteEndTime - deleteStartTime}ms`)
    }

    //Create the holding feed
    const feedCreateStartTime = performance.now()
    await req.payload.create({
      collection: 'holdings-feed',
      data: doc as HoldingsFeed,
      file: file,
      req,
    })
    const feedCreateEndTime = performance.now()
    req.payload.logger.info(
      `Created holdings feed document in ${feedCreateEndTime - feedCreateStartTime}ms`,
    )

    // Create holdings
    const holdingsCreateStartTime = performance.now()
    await createHoldings(req, processedRecords, accountToCompanyMap, stockMap, valueDate)
    const holdingsCreateEndTime = performance.now()
    req.payload.logger.info(
      `Created holdings in ${holdingsCreateEndTime - holdingsCreateStartTime}ms`,
    )

    const processEndTime = performance.now()
    req.payload.logger.info(
      `Successfully processed ${processedRecords.length} holdings for date ${valueDate} in ${processEndTime - processStartTime}ms`,
    )

    return validationResult
  } catch (error) {
    const errorTime = performance.now()
    req.payload.logger.error(
      `Error processing holdings feed after ${errorTime - processStartTime}ms: ${JSON.stringify(error)}`,
    )
    throw error
  }
}
