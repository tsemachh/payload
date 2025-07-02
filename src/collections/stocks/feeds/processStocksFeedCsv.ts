import { PayloadRequest } from 'payload'
import {
  createStocksMap,
  upsertStockFromImport,
  upsertStockValueFromImport,
} from '@/utils/migrateUtils'
import csvToJson from 'convert-csv-to-json'
import { getStockType, parseDate } from '@/utils/migrateStockUtils'
import iconv from 'iconv-lite'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { StocksFeed, StockType } from '@/payload-types'

export const processStocksFeedCsv = async (
  req: PayloadRequest,
  data: any,
  stockFeed: StocksFeed,
): Promise<{ processedRows: number; fileLength: number; errors: string[] }> => {
  const startTime = Date.now()
  let processedRows = 0
  let fileLength = 0
  const errors: string[] = []
  try {
    // Start timing the entire process
    console.time('Total stocks processing time')

    // The file is at req.file as specified in the issue description
    const file = data.file

    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push(`No file found in request`)
      return { processedRows: 0, fileLength, errors }
    }

    // Read the file content
    const csvData = iconv.decode(file.data, 'windows-1255')
    //const csvData = file.data.toString('utf8')

    // Parse the CSV file using csvToJson as specified in the issue description
    const results = csvToJson.fieldDelimiter(',').csvStringToJson(csvData)
    const valueDate = parseDate(results[0].stockID)
    // Convert JSON data to ImportStock format
    results.shift()
    results.pop()
    // Trim all string values in each object of the results array
    results.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (typeof item[key] === 'string') {
          item[key] = item[key].trim()
        }
      })
    })
    const rows: ImportStock[] = results.map((data) => ({
      stockID: data.stockID || ('' as string),
      name: data.name || ('' as string),
      symbol: data.symbol || ('' as string),
      type: getStockType(data.type || '') as StockType,
      closingRate: parseFloat(data.closingRate) || (0 as number),
      marketValue: parseFloat(data.marketValue) || (0 as number),
      registeredValue: parseFloat(data.registeredValue) || (0 as number),
      valueDate: valueDate.toISOString() as string,
      longName: data.longName || ('' as string),
    }))
    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    let stocksCreated = 0

    // Get the stockMap using the helper function
    const stockMap = await createStocksMap(req, 'TASE')
    // Process each row
    await req.payload.delete({
      collection: 'stock-values',
      where: {
        valueDate: { equals: new Date(valueDate).toISOString() },
      },
    })

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i]

        if (isNaN(Number(row.stockID))) {
          console.error('InvalidRowData', JSON.stringify(row))
          errors.push(`Invalid stockID at index ${i}: stockID="${row.stockID}"`)
          continue
        }

        if (row.symbol.trim() === '') {
          console.error('InvalidRowData', JSON.stringify(row))
          errors.push(`Missing symbol at index ${i}: stockID="${row.stockID}`)
          continue
        }
        const stock = stockMap.get(`${row.stockID}` as string)

        if (stock == null) stocksCreated++
        const stockSequence = await upsertStockFromImport(stock || null, row, req, true)
        if (stockSequence) await upsertStockValueFromImport(stockSequence, row, req)

        processedRows++
        // Notify progress every 10 stocks
        if (processedRows % 100 === 0) {
          const progressMsg = `Progress: ${processedRows}/${rows.length} stocks processed (${Math.round((processedRows / rows.length) * 100)}%)`
          console.log(progressMsg)
          req.payload.logger.info(progressMsg)
        }
      } catch (rowError) {
        req.payload.logger.error(`Error processing row ${i}: ${JSON.stringify(rowError)}`, rowError)
        // Continue with the next row
      }
    }

    // Wait for all stock value upserts to complete
    //    await pool.waitForAll()
    stockFeed.summary = `processed ${processedRows} stocks out of ${rows.length}, ${stocksCreated} stocks created`
    req.payload.logger.info(
      `Successfully processed ${processedRows} out of ${rows.length} rows from CSV file: ${file.name}`,
    )
    fileLength = rows.length

    // End timing the entire process
    const endTime = Date.now()
    const totalProcessingTime = endTime - startTime
    console.log(`Total processing time: ${totalProcessingTime}ms`)
    console.timeEnd('Total stocks processing time')
    return { processedRows, fileLength, errors }
  } catch (error) {
    console.error(error)
    req.payload.logger.error(`Error processing stock feed CSV: ${JSON.stringify(error)}`)

    // End timing even if there's an error
    const endTime = Date.now()
    const totalProcessingTime = endTime - startTime
    console.log(`Total processing time (with error): ${totalProcessingTime}ms`)
    console.timeEnd('Total stocks processing time')
    return { processedRows, fileLength, errors }
  }
}
