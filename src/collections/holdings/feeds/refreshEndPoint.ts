import {
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
} from '@/collections/holdings/feeds/FeedDataUtils';
import { validateRow } from '@/collections/holdings/feeds/FeedValidations';
import { HoldingFeedLine } from '@/payload-types';
import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes';

const validationResult: FeedValidationResult = {
  fatalErrors: [],
  warnings: [],
  recordErrors: [],
  validRecords: [],
  silencedRecords: [],
};

const refreshEndPoint = async (req: PayloadRequest) => {
  const { companies } = req.query;
  await addDataAndFileToRequest(req)
  if (req === null) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!req.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  // @ts-expect-error req not null
  const standardizedRecords = await req.json()
 //const standardizedRecords = await req?.json()

  console.log("-----@@@companies", companies);
  console.log("-----@@@records", standardizedRecords);

  // Ensure we have an array to work with
  const recordsArray: any[] = Array.isArray(standardizedRecords)
    ? standardizedRecords
    : standardizedRecords
      ? [standardizedRecords]
      : [];

  console.log("-----@@@recordsArray", recordsArray);

  // Parse companies parameter
  let selectedCompanies: string[] = [];
  if (companies) {
    try {
      selectedCompanies = Array.isArray(companies)
        ? companies
        : typeof companies === 'string'
          ? companies.includes('[')
            ? JSON.parse(companies)
            : companies.split(',')
          : [];
    } catch (e) {
      console.error("Error parsing companies parameter:", e);
      selectedCompanies = (companies as string).split(',');
    }
  }

  console.log("-----@@@selectedCompanies", selectedCompanies);

  const accountToCompanyMap = await preloadAccountsToCompanyMap(
    req,
    selectedCompanies,
  );

  const stockMap = await preloadStocks(req, recordsArray);
  console.log("-----@@@selectedCompanies", selectedCompanies);

  const processedRecords: HoldingFeedLine[] = [];
  const allSilencedStocks = await fetchAllSilencedStocks(req, selectedCompanies);
  console.log("-----@@@selectedCompanies", selectedCompanies);

  const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId);
  console.log("-----@@@selectedCompanies", selectedCompanies);

  for (const [index, row] of recordsArray.entries()) {
    const { processedRecord } = await validateRow(row, index, accountToCompanyMap, stockMap, silencedStockIds);
    processedRecords.push(processedRecord);

    if (processedRecord.status === 'error') {
      validationResult.recordErrors.push(processedRecord);
    }
    else if (processedRecord.status === 'success') {
      validationResult.validRecords.push(processedRecord);
    } else {
      validationResult.silencedRecords.push(processedRecord);
    }
  }

  console.log("-----@@@validationResult.silencedRecords", validationResult.silencedRecords);
  console.log("-----@@@validationResult.validRecords", validationResult.validRecords);
  console.log("-----@@@validationResult", validationResult);


    return Response.json({
      validationResult,
    })
}


export default refreshEndPoint;
