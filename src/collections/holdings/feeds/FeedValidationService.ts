import {
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
} from '@/collections/holdings/feeds/FeedDataUtils';
import { validateRow } from '@/collections/holdings/feeds/FeedValidations';
import { PayloadRequest } from 'payload';
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes';

// קבוע שמכיל את הערכים ההתחלתיים
export const emptyValidationResult: FeedValidationResult = {
  fatalErrors: [],
  warnings: [],
  recordErrors: [],
  validRecords: [],
  silencedRecords: [],
};

// הפונקציה שתבצע את כל התהליך
export async function processValidationData(
  req: PayloadRequest,
  selectedCompanies: string[],
  rows: StandardizedRow[]
): Promise<FeedValidationResult> {
  // טעינת הנתונים
  const accountToCompanyMap = await preloadAccountsToCompanyMap(req, selectedCompanies);
  const stockMap = await preloadStocks(req, rows);
  const allSilencedStocks = await fetchAllSilencedStocks(req, selectedCompanies);
  const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId);

  // יצירת אובייקט תוצאה להתחלת תהליך האימות
  const validationResult = emptyValidationResult;

  // ריצה על כל השורות ולולאת אימות
  for (const [index, row] of rows.entries()) {
    const { processedRecord } = await validateRow(
      row,
      index,
      accountToCompanyMap,
      stockMap,
      silencedStockIds
    );

    // מיון התוצאות לפי סטטוס
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
