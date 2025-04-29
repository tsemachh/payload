


import {
  preloadAccountsToCompanyMap,
  preloadStocks,
  fetchAllSilencedStocks,
} from '@/collections/holdings/feeds/FeedDataUtils'
import {  validateRow } from '@/collections/holdings/feeds/FeedValidations'

// Process each standardized row
import { HoldingFeedLine } from '@/payload-types'
import { PayloadRequest } from 'payload'
import { FeedValidationResult, StandardizedRow } from '@/collections/holdings/feeds/FeedTypes'

const validationResult: FeedValidationResult = {
  fatalErrors: [],
  warnings: [],
  recordErrors: [],
  validRecords: [],
  silencedRecords: [],
}


const refreshEndPoint = async (req: PayloadRequest) => {
  const {  companies } = req.query
  const  records  = req.data // records should be parsed correctly now

// TODO ??????
  const recordsArray: StandardizedRow[] = Array.isArray(records)
    ? records
    : records
      ? [records]
      : [];


  // Optional companies parameter as JSON string of company IDs
  let selectedCompanies: string[] = []
  if (companies) {
    try {
      selectedCompanies = JSON.parse(companies as string)
    } catch (e) {
      // If parsing fails, try treating it as a comma-separated string
      selectedCompanies = (companies as string).split(',')
    }
  }

  const accountToCompanyMap = await preloadAccountsToCompanyMap(
    req,
    selectedCompanies as string[],
  )

const stockMap = await preloadStocks(req, recordsArray)

const processedRecords: HoldingFeedLine[] = []
const allSilencedStocks = await fetchAllSilencedStocks(req,companies as string[]);
const silencedStockIds = allSilencedStocks.map((stock) => stock.stockId);  // סגור את הסוגריים כאן

for (const [index, row] of recordsArray.entries()) {
  const { processedRecord } = await validateRow(row, index, accountToCompanyMap, stockMap, silencedStockIds)
  processedRecords.push(processedRecord)

  if (processedRecord.status === 'error') {
    validationResult.recordErrors.push(processedRecord)
  }
  else if (processedRecord.status === 'success') {
    validationResult.validRecords.push(processedRecord)
  } else
    validationResult.silencedRecords.push(processedRecord)
}
console.log("-----validationResult.silencedRecords",validationResult.silencedRecords)
console.log("-----validationResult.validRecords",validationResult.validRecords)

return validationResult
}

export default refreshEndPoint