import {
  ACCOUNT_ID_COL,
  QUANTITY_COL,
  StandardizedRow,
  STOCK_ID_COL,
} from '@/collections/holdings/feeds/FeedTypes'
import csvToJson from 'convert-csv-to-json'
import * as XLSX from 'xlsx'

/**
 * Parse file content based on file extension
 * @param file The file to parse
 * @returns Parsed file content as an array
 */
export const parseFileContent = (file: any): any[] | undefined => {
  const fileExt = file.name.split('.').pop()?.toLowerCase()

  if (fileExt === 'csv') {
    let csvData = file.data.toString('utf8')
    csvData = '0,1,2\r\n' + csvData
    // Parse CSV without using generateHeaderNames which can cause errors
    return csvToJson.fieldDelimiter(',').csvStringToJson(csvData)
  } else if (fileExt === 'xlsx' || fileExt === 'xls') {
    const workbook = XLSX.read(file.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const results: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    return results.filter((row) => row.length > 0)
  }
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
