import { PayloadRequest } from 'payload'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { getSeqeunceStockId } from '@/utils/utils'
import { upsertStockFromImport, upsertStockValueFromImport } from '@/utils/migrateUtils'
import csvToJson from 'convert-csv-to-json'

export const processStocksFeedCsv = async (req: PayloadRequest, doc: any): Promise<void> => {
  try {
    // The file is at req.file as specified in the issue description
    const file = req.file

    if (!file) {
      req.payload.logger.error(`No file found in request`)
      return
    }

    // Read the file content
    const csvData = file.data.toString('utf8')

    // Parse the CSV file using csvToJson as specified in the issue description
    const results = csvToJson.fieldDelimiter(',').parseSubArray('*', ',').csvStringToJson(csvData)

    // Convert JSON data to ImportStock format
    const rows: ImportStock[] = results.map(data => ({
      stockID: data.stockID || '',
      name: data.name || '',
      symbol: data.symbol || '',
      type: data.type || '',
      closingRate: parseFloat(data.closingRate) || 0,
      marketValue: parseFloat(data.marketValue) || 0,
      registeredValue: parseFloat(data.registeredValue) || 0,
      valueDate: data.valueDate || (doc && doc.date ? doc.date : new Date().toISOString().split('T')[0]),
      longName: data.longName || '',
    }))

    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      let stockSequence = await getSeqeunceStockId(req.payload, `${row.stockID}` as string)
      stockSequence = await upsertStockFromImport(stockSequence, row, req, true)
      await upsertStockValueFromImport(stockSequence, row, req)
    }

    req.payload.logger.info(`Successfully processed ${rows.length} rows from CSV file: ${file.name}`)
  } catch (error) {
    req.payload.logger.error(`Error processing stock feed CSV: ${JSON.stringify(error)}`)
  }
}
