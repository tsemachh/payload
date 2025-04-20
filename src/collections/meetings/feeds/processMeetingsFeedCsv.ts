import { PayloadRequest } from 'payload'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { getStockByStockId } from '@/utils/utils'
import { upsertStockFromImport, upsertStockValueFromImport } from '@/utils/migrateUtils'
import csvToJson from 'convert-csv-to-json'
import { getStockType, parseDate } from '@/utils/migrateStockUtils'
import iconv from 'iconv-lite'
export const processMeetingsFeedCsv = async (req: PayloadRequest, doc: any): Promise<void> => {
  try {
    // The file is at req.file as specified in the issue description
    const file = req.file

    if (!file) {
      req.payload.logger.error(`No file found in request`)
      return
    }

    // Read the file content
    const csvData = iconv.decode(file.data, 'windows-1255');
    //const csvData = file.data.toString('utf8')

    // Parse the CSV file using csvToJson as specified in the issue description
    const results = csvToJson.fieldDelimiter('\t').csvStringToJson(csvData)
    results.forEach(item => {
      Object.keys(item).forEach(key => {
        if (typeof item[key] === 'string') {
          item[key] = item[key].trim();
        }
      });
    });
    const valueDate= parseDate(results[0].security_id)
    // Convert JSON data to ImportStock format
    results.shift()
    results.pop()
    const rows: any[] = results.map(data => ({
      stockID: data.security_id || '',
      name: data.name_short?.trim() || '',
      symbol: data.symbol_hebrew || '',
      type: getStockType(data.name?.trim() || ''),
      closingRate: parseFloat(data.price_close) || 0,
      marketValue: parseFloat(data.marketvalue) || 0,
      registeredValue: parseFloat(data.registeredvalue) || 0,
      valueDate: valueDate,
      //longName: data.longName?.trim() || '',
    }))
    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const stock = await getStockByStockId(req.payload, `${row.stockID}` as string)
      const stockSequence = await upsertStockFromImport(stock, row, req, true)
      await upsertStockValueFromImport(stockSequence, row, req)
    }

    req.payload.logger.info(`Successfully processed ${rows.length} rows from CSV file: ${file.name}`)
  } catch (error) {
    req.payload.logger.error(`Error processing stock feed CSV: ${JSON.stringify(error)}`)
  }
}
