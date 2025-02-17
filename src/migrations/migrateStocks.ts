import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock, StockValue } from '@/payload-types'
import { getSeqeunceStockId, getSeqeunceStockValueId } from '../utils/utils' // Then you can use sql.close() directly

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'master', // Change this to your database name once created
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true // For local dev
  },
  requestTimeout: 120000, // Increase timeout globally to 120 seconds
}
const stockTypesMap = new Map([
  ["אג\"ח היברידי קונצרני", "איגרות חוב"],
  ["אג\"ח קונצרני זר חו\"ל IG", "איגרות חוב"],
  ["אגח - השאלה", "איגרות חוב"],
  ["אופציה", "אופציות"],
  ["יה\"ש", "יחידת השתתפות"],
  ["יחידת השתתפות", "יחידת השתתפות"],
  ["מניות חול - זיקה לישראל", "מניות"],
  ["קרנות סל מניות ישראל", "קרנות נאמנות"],
  ["אג\"ח", "איגרות חוב"],
  ["אגרות חוב", "איגרות חוב"],
  ["אופציות מניות", "אופציות"],
  ["הלוואות לא סחירות", "אחר"],
  ["זכויות", "זכויות"],
  ["כתב אופציה מניות", "אופציות"],
  ["מניות - קרנות סל מניות חו\"ל", "קרנות נאמנות"],
  ["מניות דואליות חו\"ל - דולר", "מניות"],
  ["נע\"מ", "נייר ערך מסחרי"],
  ["אג\"ח - השאלה", "איגרות חוב"],
  ["יחידות השתתפות", "יחידת השתתפות"],
  ["מניות יתר", "מניות"],
  ["נייר ערך מסחרי", "נייר ערך מסחרי"],
  ["קרן טכנולוגיה עילית", "אחר"],
  ["קרנות סל מניות חול", "קרנות נאמנות"],
  ["תעודות סל מנייתיות ארה\"ב", "תעודות סל"],
  ["תעודות סל שאר העולם דולר", "תעודות סל"],
  ["תעודות סל שאר העולם יורו", "תעודות סל"],
  ["תעודת סל", "תעודות סל"],
  ["תעודת סל מנית חול", "תעודות סל"],
  ["אופציה על מניה", "אופציות"],
  ["אופציות מעוף", "אופציות"],
  ["איגרות חוב להמרה", "איגרות חוב"],
  ["מניות חו\"ל - ארה\"ב דולר", "מניות"],
  ["מניות חול - אירופה יורו", "מניות"],
  ["מניות ישראליות ארה\"ב-דולר", "מניות"],
  ["מניות ישראליות דואליות דולר", "מניות"],
  ["קרן נאמנות", "קרנות נאמנות"],
  ["שטר הון", "שטרי הון"],
  ["ת סל אג\"ח ממשלתי", "תעודות סל"],
  ["תעודת מדד", "תעודות סל"],
  ["תעודת סל אג\"ח IG", "תעודות סל"],
  ["כתבי אופציה",  "אופציות"],
  ["מוצר מובנה", "אחר"],
  ["מניות לא סחירות בחו\"ל", "מניות"],
  ["מק\"מ", "מק\"מ"],
  ["קרנות סל", "קרנות נאמנות"],
  ["ריבית של אג\"ח חו\"ל", "איגרות חוב"],
  ["תעודות סל אג\"ח HY", "תעודות סל"],
  ["תעודות סל אירופה יורו", "תעודות סל"],
  ["תעודות סל ארה\"ב דולר", "תעודות סל"],
  ["אג\"ח קונצרני ישראלי חו\"ל", "איגרות חוב"],
  ["אגח קונצרן", "איגרות חוב"],
  ["איגרות חוב", "איגרות חוב"],
  ["חוב מובנה בחו\"ל - CLO דולר", "איגרות חוב"],
  ["מניה לא סחירה", "מניות"],
  ["מניות חו\"ל - יין יפני", "מניות"],
  ["מניות ישראליות דואליות-שטרלינג", "מניות"],
  ["מניות לא סחירות", "מניות"],
  ["קרן סל חו\"ל", "קרנות נאמנות"],
  ["תעודות סל", "תעודות סל"],
  ["תעודות סל מניות חול", "תעודות סל"],
  ["איגרות חוב", "איגרות חוב"],
  ["אג\"ח זר COCO מחיקה", "איגרות חוב"],
  ["אג\"ח לא סחיר", "איגרות חוב"],
  ["אופציות", "אופציות"],
  ["חוב מובנה בחו\"ל - CLO יורו", "איגרות חוב"],
  ["מניות - חוזים על סחורות", "מניות"],
  ["מניות חו\"ל - שאר העולם דולר", "מניות"],
  ["מניות ישראליות בחול - דולר", "מניות"],
  ["קרנות נאמנות", "קרנות נאמנות"],
  ["ת סל אג\"ח ממשלתי EM מטבע מקומי", "תעודות סל"],
  ["תעודות סל זרות בחו\"ל - דולר", "תעודות סל"],
  ["תעודת סל מניות חו\"ל", "תעודות סל"],
  ["אגח זר COCO המרה", "איגרות חוב"],
  ["מניה", "מניות"],
  ["מניות", "מניות"],
  ["קרן נאמנות/סל/השקעה", "קרנות נאמנות"],
  ["שטרי הון", "שטרי הון"],
  ["תעודות סל אירופה לישט", "תעודות סל"],
  ["אג\"ח קונצרני זר חו\"ל HY", "איגרות חוב"],
  ["אופציה על מניה לא סחירה", "אופציות"],
  ["אופציות על מניות בארץ", "אופציות"],
  ["איגרות חוב לא סחיר", "איגרות חוב"],
  ["קרן סל", "קרנות נאמנות"],
  ["קרנות סל שקליות", "קרנות נאמנות"],
  ["תעודות סל אירופה דולר", "תעודות סל"],
  ["תעודות סל יפן דולר", "תעודות סל"],
  ["תעודות סל יפן יין", "תעודות סל"],
  ["אג\"ח היברידי פיננסי ביטוח", "איגרות חוב"],
  ["אג\"ח ממשלתיות", "איגרות חוב"],
  ["הלוואות", "אחר"],
  ["מניות ל\"ס", "מניות"],
  ["קרן סל מניות חו\"ל", "קרנות נאמנות"],
  ["קרנות סל מניות חו\"ל", "קרנות נאמנות"],
  ["תעודות סל זרות בחו\"ל -יורו", "תעודות סל"]
]);

// @ts-ignore
function getStockType(row) {
  // Example usage:
  let stocktype = row.type
  if (stocktype) stocktype = stocktype.trim()
  // @ts-ignore
  const assetType = stockTypesMap.get(stocktype)
  if (assetType) stocktype = assetType
  return stocktype
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
/*    await payload.delete({
      collection: 'stocks',
      where: {},
    })

    await payload.delete({
      collection: 'stock-values',
      where: {},
    })*/
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    // Query the last 30 days of data
    console.log('Executing SQL query for last 30 days of stock data...')
    const result = await pool.request().query(`
      SELECT stockID, name, symbol, type, closingRate, marketValue, registeredValue, valueDate, logUpdateID, longName
      FROM [dbEmda].[dbo].[stocks]
      WHERE [valueDate] >= DATEADD(DAY, -60, GETDATE())
      ORDER BY valueDate ASC;
    `)

      console.log(`Retrieved ${result.recordset.length} records from SQL Server`)

    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    let stockData: Stock | null = null;
    let stockValue: StockValue | null = null;
    const stocks:Set<string>=new Set()
      for (const row of result.recordset) {
      try {
        const stockID:number = parseInt(row.stockID); // Example ObjectId
        let stockSequence = await getSeqeunceStockId(payload, stockID)

        if (!stocks.has(row.stockID) && !stockSequence) {
            const stocktype = getStockType(row)
            // @ts-ignore
            stockData = {
              stockId: stockID,
              name: row.name,
              symbol: row.symbol,
              type: stocktype,
              longName: row.longName
            }
            console.log("stockData",JSON.stringify(stockData))
            // Insert into Payload CMS
            const newStock:Stock=await payload.create({
              collection: 'stocks',
              data: stockData as Stock,
            })
          stockSequence=newStock.id;
          stocks.add(row.stockID);
        }
         
        // @ts-ignore
        stockValue = {
          stockId: stockSequence as string,
          valueDate: row.valueDate,
          closingRate: row.closingRate,
          marketValue: row.marketValue,
          registeredValue: row.registeredValue,
          createdAt : row.createdAt,
        }

        //console.log("Data",JSON.stringify(stockData, null, 2))
        const id = await getSeqeunceStockValueId(payload, row.stockID,row.valueDate)
        if (id) {
          // Update Payload CMS
          await payload.update({
            collection: 'stock-values',
            id: id,
            data: stockValue as StockValue,
            req,
          })
        } else {
          // Insert into Payload CMS
          await payload.create({
            collection: 'stock-values',
            data: stockValue as StockValue,
          })
        }

        successCount++
        console.log(`✓ Inserted stock: ${row.symbol} (${successCount}/${result.recordset.length})`)
      } catch (insertError) {
        errorCount++
        console.log("ROW",JSON.stringify(row, null, 2))
        console.log("Data",JSON.stringify(stockData, null, 2))
        console.error(`✗ Failed to insert stock ${row.symbol}:`, insertError)
        throw insertError;
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total records processed: ${result.recordset.length}`)
    console.log(`Successfully inserted: ${successCount}`)
    console.log(`Failed insertions: ${errorCount}`)
    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Critical error during migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  } finally {
    console.log('Closing SQL Server connection...')
    if (pool) {
      await pool.close() // Close the connection pool
    }
    console.log('SQL Server connection closed')
  }
}

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This should ideally revert any changes made in the up function
// }
