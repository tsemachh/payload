import { ACCOUNT_ID_COL, QUANTITY_COL, StandardizedRow, STOCK_ID_COL } from '@/collections/holdings/feeds/FeedTypes'
import csvToJson from 'convert-csv-to-json'
import * as XLSX from 'xlsx'

/**
 * Parse file content based on file extension
 * @param file The file to parse
 * @returns Parsed file content as an array
 */
export const parseFileContent = (file: any): any[] => {
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
export const standardizeRows = (results: any[]): StandardizedRow[] => {
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
