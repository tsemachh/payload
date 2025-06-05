import { PayloadRequest } from 'payload'
import { upsertStockFromImport, upsertStockValueFromImport, createStocksMap } from '@/utils/migrateUtils'
import csvToJson from 'convert-csv-to-json'
import { getStockType, parseDate } from '@/utils/migrateStockUtils'
import iconv from 'iconv-lite'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { StocksFeed, StockType } from '@/payload-types'
import { PromisePool } from '@/utils/promisePool'
export const processStocksFeedCsv = async (req: PayloadRequest, data:StocksFeed): Promise<void> => {
  const startTime = Date.now();

  try {

    // Start timing the entire process
    console.time('Total stocks processing time');

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
    const results = csvToJson.fieldDelimiter(',').csvStringToJson(csvData)
    const valueDate = parseDate(results[0].stockID)
    // Convert JSON data to ImportStock format
    results.shift()
    results.pop()
    // Trim all string values in each object of the results array
    results.forEach(item => {
      Object.keys(item).forEach(key => {
        if (typeof item[key] === 'string') {
          item[key] = item[key].trim();
        }
      });
    });
    const rows: ImportStock[] = results.map(data => ({
      stockID: data.stockID || '' as string,
      name: data.name || '' as string,
      symbol: data.symbol || '' as string,
      type: getStockType(data.type || '') as StockType,
      closingRate: parseFloat(data.closingRate) || 0 as number,
      marketValue: parseFloat(data.marketValue) || 0 as number,
      registeredValue: parseFloat(data.registeredValue) || 0 as number,
      valueDate: valueDate.toISOString() as string,
      longName: data.longName || '' as string,
    }))
    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    let stocksCreated=0
    let processedRows=0

    // Create a Promise Pool with concurrency of 20
    const pool = new PromisePool(4);
    // Get the stockMap using the helper function
    const stockMap = await createStocksMap(req,"TASE")
    // Process each row
    for (let i = 0; i < rows.length; i++) {
      try {

        const row = rows[i]

        // Add the upsertStockValueFromImport call to the Promise Pool
        pool.add(async () => {
          //const valueStartTime = Date.now();
          const stock = stockMap.get(`${row.stockID}` as string)
          if (stock == null) stocksCreated++
          const stockSequence = await upsertStockFromImport(stock || null, row, req, true)
          if (stockSequence)
            await upsertStockValueFromImport(stockSequence, row, req);
          //const valueEndTime = Date.now();
          //const valueProcessingTime = valueEndTime - valueStartTime;
          //console.log(`Stock value for record ${i+1}/${rows.length} (ID: ${row.stockID}) processed in ${valueProcessingTime}ms`);
        });
        processedRows++

      } catch (rowError) {
        req.payload.logger.error(`Error processing row ${i}: ${JSON.stringify(rowError)}`,rowError)
        // Continue with the next row
      }
    }

    // Wait for all stock value upserts to complete
    await pool.waitForAll();
    data.comments = `processed ${processedRows} stocks out of ${rows.length}, ${stocksCreated} stocks created`
    req.payload.logger.info(`Successfully processed ${processedRows} out of ${rows.length} rows from CSV file: ${file.name}`)
    req.payload.update({
      collection:'stocks-feed',
      id:data.id,
      context:{from:"process"},
      data,
    })

    // End timing the entire process
    const endTime = Date.now();
    const totalProcessingTime = endTime - startTime;
    console.log(`Total processing time: ${totalProcessingTime}ms`);
    console.timeEnd('Total stocks processing time');
  } catch (error) {
    req.payload.logger.error(`Error processing stock feed CSV: ${JSON.stringify(error)}`)

    // End timing even if there's an error
    const endTime = Date.now();
    const totalProcessingTime = endTime - startTime;
    console.log(`Total processing time (with error): ${totalProcessingTime}ms`);
    console.timeEnd('Total stocks processing time');
  }
}
