import {
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
} from '@/collections/holdings/feeds/FeedDataUtils';
import { validateRow } from '@/collections/holdings/feeds/FeedValidations';
import { PayloadRequest } from 'payload';
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes';

export function initializeValidationResult(): FeedValidationResult {
  return {
    fatalErrors: [],
    warnings: [],
    recordErrors: [],
    validRecords: [],
    silencedRecords: [],
  };
}

export async function loadValidationData(
  req: PayloadRequest,
  selectedCompanies: string[],
  rows: StandardizedRow[],
) {
  const accountToCompanyMap = await preloadAccountsToCompanyMap(req, selectedCompanies);
  const stockMap = await preloadStocks(req, rows);
  const allSilencedStocks = await fetchAllSilencedStocks(req, selectedCompanies);
  const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId);

  return { accountToCompanyMap, stockMap, silencedStockIds };
}

export async function runValidationLoop(
  rows: StandardizedRow[],
  accountToCompanyMap: Map<number, string>,
  stockMap: Map<string, string>,
  silencedStockIds: string[],
  validationResult: FeedValidationResult,
): Promise<FeedValidationResult> {
  for (const [index, row] of rows.entries()) {
    const { processedRecord } = await validateRow(
      row,
      index,
      accountToCompanyMap,
      stockMap,
      silencedStockIds,
    );

    if (processedRecord.status === 'error') {
      validationResult.recordErrors.push(processedRecord);
    } else if (processedRecord.status === 'success') {
      validationResult.validRecords.push(processedRecord);
    } else {
      validationResult.silencedRecords.push(processedRecord);
    }
  }

  return validationResult;
}
