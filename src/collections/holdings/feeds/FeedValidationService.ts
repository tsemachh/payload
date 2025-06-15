import {
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
} from '@/collections/holdings/feeds/FeedDataUtils'
import { validateRow } from '@/collections/holdings/feeds/FeedValidations'
import { PayloadRequest } from 'payload'
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'
} from '@/collections/holdings/feeds/FeedDataUtils'
import { validateRow } from '@/collections/holdings/feeds/FeedValidations'
import { PayloadRequest } from 'payload'
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'

export async function processValidationData(
  req: PayloadRequest,
  selectedCompanies: string[],
  rows: StandardizedRow[],
  validationResult: FeedValidationResult,
): Promise<FeedValidationResult> {
  const { accountToCompanyMapI: accountToCompanyMap, accountNameMap } =
    await preloadAccountsToCompanyMap(req, selectedCompanies)
  const { stockIdMap: stockMap, stockNameMap, stockActiveMap } = await preloadStocks(req, rows)
  const allSilencedStocks = await fetchAllSilencedStocks(req, selectedCompanies)
  const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId)

  for (const [index, row] of rows.entries()) {
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

    if (processedRecord.status === 'error') {
      validationResult.recordErrors.push(processedRecord)
    } else if (processedRecord.status === 'success') {
      validationResult.validRecords.push(processedRecord)
    } else {
      validationResult.silencedRecords.push(processedRecord)
    }
  }

  return validationResult
}
