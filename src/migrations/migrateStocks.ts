import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import sql from 'mssql'
import { Stock, StockType } from '@/payload-types'
import { getSeqeunceStockId } from '../utils/utils'
import {
  getAllStocksInMeetings,
  getEmdaStockIds,
  getPredictaStockIds,
  getStockRelations,
  getStocks,
  getStockValues, upsertStockFromImport, upsertStockValueFromImport,
} from '@/utils/migrateUtils'
import {
  logMigrationFault,
  createStockFaultComment,
  createStockRelationFaultComment, createErrorFaultComment, createStockValueFaultComment,
} from '@/utils/migrationFaultUtils'

interface StockRow {
  stockID: string
  type?: string | null
  symbol?: string
  name?: string
  tradable?: boolean
  active?: boolean
  lastTradeDate?: Date | null
  lastTradePrice?: number | null
}

// SQL Server configuration
const sqlConfig: sql.config = {
  user: 'sa',
  password: 'dockerStrongPwd123',
  database: 'master', // Change this to your database name once created
  server: 'localhost',
  port: 1433,
  options: {
    encrypt: false, // For local dev, set to false
    trustServerCertificate: true, // For local dev
  },
  requestTimeout: 120000, // Increase timeout globally to 120 seconds
}
const stockTypesMap: Map<string, StockType> = new Map([
  ['אג"ח היברידי קונצרני', 'איגרות חוב'],
  ['אג"ח קונצרני זר חו"ל IG', 'איגרות חוב'],
  ['אגח - השאלה', 'איגרות חוב'],
  ['אופציה', 'אופציות'],
  ['יה"ש', 'יחידת השתתפות'],
  ['יחידת השתתפות', 'יחידת השתתפות'],
  ['מניות חול - זיקה לישראל', 'מניות'],
  ['קרנות סל מניות ישראל', 'קרנות נאמנות'],
  ['אג"ח', 'איגרות חוב'],
  ['אגרות חוב', 'איגרות חוב'],
  ['אופציות מניות', 'אופציות'],
  ['הלוואות לא סחירות', 'אחר'],
  ['זכויות', 'זכויות'],
  ['כתב אופציה מניות', 'אופציות'],
  ['מניות - קרנות סל מניות חו"ל', 'קרנות נאמנות'],
  ['מניות דואליות חו"ל - דולר', 'מניות'],
  ['נע"מ', 'נייר ערך מסחרי'],
  ['אג"ח - השאלה', 'איגרות חוב'],
  ['יחידות השתתפות', 'יחידת השתתפות'],
  ['מניות יתר', 'מניות'],
  ['נייר ערך מסחרי', 'נייר ערך מסחרי'],
  ['קרן טכנולוגיה עילית', 'אחר'],
  ['קרנות סל מניות חול', 'קרנות נאמנות'],
  ['תעודות סל מנייתיות ארה"ב', 'תעודות סל'],
  ['תעודות סל שאר העולם דולר', 'תעודות סל'],
  ['תעודות סל שאר העולם יורו', 'תעודות סל'],
  ['תעודת סל', 'תעודות סל'],
  ['תעודת סל מנית חול', 'תעודות סל'],
  ['אופציה על מניה', 'אופציות'],
  ['אופציות מעוף', 'אופציות'],
  ['איגרות חוב להמרה', 'איגרות חוב'],
  ['מניות חו"ל - ארה"ב דולר', 'מניות'],
  ['מניות חול - אירופה יורו', 'מניות'],
  ['מניות ישראליות ארה"ב-דולר', 'מניות'],
  ['מניות ישראליות דואליות דולר', 'מניות'],
  ['קרן נאמנות', 'קרנות נאמנות'],
  ['שטר הון', 'שטרי הון'],
  ['ת סל אג"ח ממשלתי', 'תעודות סל'],
  ['תעודת מדד', 'תעודות סל'],
  ['תעודת סל אג"ח IG', 'תעודות סל'],
  ['כתבי אופציה', 'אופציות'],
  ['מוצר מובנה', 'אחר'],
  ['מניות לא סחירות בחו"ל', 'מניות'],
  ['מק"מ', 'מק"מ'],
  ['קרנות סל', 'קרנות נאמנות'],
  ['ריבית של אג"ח חו"ל', 'איגרות חוב'],
  ['תעודות סל אג"ח HY', 'תעודות סל'],
  ['תעודות סל אירופה יורו', 'תעודות סל'],
  ['תעודות סל ארה"ב דולר', 'תעודות סל'],
  ['אג"ח קונצרני ישראלי חו"ל', 'איגרות חוב'],
  ['אגח קונצרן', 'איגרות חוב'],
  ['איגרות חוב', 'איגרות חוב'],
  ['חוב מובנה בחו"ל - CLO דולר', 'איגרות חוב'],
  ['מניה לא סחירה', 'מניות'],
  ['מניות חו"ל - יין יפני', 'מניות'],
  ['מניות ישראליות דואליות-שטרלינג', 'מניות'],
  ['מניות לא סחירות', 'מניות'],
  ['קרן סל חו"ל', 'קרנות נאמנות'],
  ['תעודות סל', 'תעודות סל'],
  ['תעודות סל מניות חול', 'תעודות סל'],
  ['איגרות חוב', 'איגרות חוב'],
  ['אג"ח זר COCO מחיקה', 'איגרות חוב'],
  ['אג"ח לא סחיר', 'איגרות חוב'],
  ['אופציות', 'אופציות'],
  ['חוב מובנה בחו"ל - CLO יורו', 'איגרות חוב'],
  ['מניות - חוזים על סחורות', 'מניות'],
  ['מניות חו"ל - שאר העולם דולר', 'מניות'],
  ['מניות ישראליות בחול - דולר', 'מניות'],
  ['קרנות נאמנות', 'קרנות נאמנות'],
  ['ת סל אג"ח ממשלתי EM מטבע מקומי', 'תעודות סל'],
  ['תעודות סל זרות בחו"ל - דולר', 'תעודות סל'],
  ['תעודת סל מניות חו"ל', 'תעודות סל'],
  ['אגח זר COCO המרה', 'איגרות חוב'],
  ['מניה', 'מניות'],
  ['מניות', 'מניות'],
  ['קרן נאמנות/סל/השקעה', 'קרנות נאמנות'],
  ['שטרי הון', 'שטרי הון'],
  ['תעודות סל אירופה לישט', 'תעודות סל'],
  ['אג"ח קונצרני זר חו"ל HY', 'איגרות חוב'],
  ['אופציה על מניה לא סחירה', 'אופציות'],
  ['אופציות על מניות בארץ', 'אופציות'],
  ['איגרות חוב לא סחיר', 'איגרות חוב'],
  ['קרן סל', 'קרנות נאמנות'],
  ['קרנות סל שקליות', 'קרנות נאמנות'],
  ['תעודות סל אירופה דולר', 'תעודות סל'],
  ['תעודות סל יפן דולר', 'תעודות סל'],
  ['תעודות סל יפן יין', 'תעודות סל'],
  ['אג"ח היברידי פיננסי ביטוח', 'איגרות חוב'],
  ['אג"ח ממשלתיות', 'איגרות חוב'],
  ['הלוואות', 'אחר'],
  ['מניות ל"ס', 'מניות'],
  ['קרן סל מניות חו"ל', 'קרנות נאמנות'],
  ['קרנות סל מניות חו"ל', 'קרנות נאמנות'],
  ['תעודות סל זרות בחו"ל -יורו', 'תעודות סל'],
])

function getStockType(row: StockRow): StockType {
  const stocktype = (row.type || '').trim()
  return stockTypesMap.get(stocktype) || 'אחר'
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let pool: sql.ConnectionPool | null = null

  try {
    console.log('Starting migration process...')
    console.log('Attempting to connect to SQL Server:', sqlConfig.server)

    // Connect to SQL Server
    pool = await sql.connect(sqlConfig)
    console.log('Successfully connected to SQL Server')

    const resultStocks = await getStocks(pool)
    const predictaStocks: Set<string> = await getPredictaStockIds(pool)
    const emdaStocks: Set<string> = await getEmdaStockIds(pool)
    const relationStocks: Map<string, string> = await getStockRelations(pool, payload)
    const rootRelatedStocks:Set<string> = new Set<string>(relationStocks.values())
    const stocksInMeeting: Set<string> = await getAllStocksInMeetings(pool)
    const resultStockValues = await getStockValues(pool)
    // Transform and insert data into Payload CMS
    console.log('Starting data transformation and insertion into Payload CMS...')
    let successCount = 0
    let errorCount = 0
    const stockIdTOSequence: Map<string, string> = new Map<string, string>()
    for (const row of resultStocks.recordset) {
      row.stockID = `${row.stockID}`
      const relatedStock = relationStocks.get(row.stockID)
      const hasTradableRelationStock:boolean = !!(relatedStock && predictaStocks.has(relatedStock))
      const hasForeignRelationStock = relatedStock && !predictaStocks.has(relatedStock)
      const isPredictaStock = predictaStocks.has(row.stockID)
      const isEmdaStock = emdaStocks.has(row.stockID)
      const stockHasMeeting = stocksInMeeting.has(row.stockID)
      const isRootForeignStock=rootRelatedStocks.has(row.stockID) && !isPredictaStock
      if (
        isPredictaStock ||
        (isEmdaStock && hasTradableRelationStock) || //TODO what shuld we do ith other stocks ? ( Foreign excahnge )?
        (hasForeignRelationStock) || (isRootForeignStock) ||
        stockHasMeeting
      ) {
        try {
          let stockSequence: string | null | undefined = stockIdTOSequence.get(row.stockID)
          if (!stockSequence) stockSequence = await getSeqeunceStockId(payload, row.stockID)
          row.type = getStockType(row)

          stockSequence=await upsertStockFromImport(stockSequence,row,req,isPredictaStock || isRootForeignStock,hasForeignRelationStock || isRootForeignStock )
          stockIdTOSequence.set(row.stockID, stockSequence)

          successCount++
          /*            console.log(
              `✓ Inserted stock : ${row.stockID} (${successCount}/${resultStocks.recordset.length})`,
            )*/
        } catch (error) {
          errorCount++
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: row.stockID,
            comments: createErrorFaultComment({
              operation: 'insert stock',
              id: row.stockID,
              error: error instanceof Error ? error : new Error(String(error)),
            }),
            row,
          })
          throw error
        }
      } else {
        await logMigrationFault({
          payload,
          type: 'stock',
          typeId: row.stockID,
          comments: createStockFaultComment({
            isPredictaStock,
            isEmdaStock,
            hasTradableRelationStock,
            stockHasMeeting,
          }),
          row,
        })
      }
    }
    successCount = 0
    errorCount = 0
    const relationStocksLength = relationStocks.size
    for (const [id1, id2] of relationStocks.entries()) {
      try {
        const relatedStock = stockIdTOSequence.get(id2)
        const theStockToUpdate = stockIdTOSequence.get(id1)
        const isPredictaStock = predictaStocks.has(id2)

        if (theStockToUpdate && relatedStock/* && isPredictaStock*/) {
          await payload.update({
            collection: 'stocks',
            id: theStockToUpdate,
            data: {
              relatedStock: relatedStock as Stock['id']
            },
            req,
          })
          successCount++
          console.log(`✓ Inserted stock relation: ${id1} (${successCount}/${relationStocksLength})`)
        } else {
          await logMigrationFault({
            payload,
            type: 'stock-relation',
            typeId: `${id1}->${id2}`,
            comments: createStockRelationFaultComment({
              stockId1: id1,
              stockId2: id2,
              isPredictaStock,
            }),
          })
          errorCount++
          console.log(
            `✗ Failed to insert stock relation ${id1} (${successCount}/${relationStocksLength})`,
          )
        }
      } catch (error) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'stock-relation',
          typeId: `${id1}->${id2}`,
          comments: createErrorFaultComment({
            operation: 'insert stock relation',
            id: `${id1}->${id2}`,
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        })
        throw error
      }
    }
    successCount = 0
    errorCount = 0

    for (const row of resultStockValues.recordset) {
      try {
        row.stockID = `${row.stockID}`
        const stockSequence = stockIdTOSequence.get(row.stockID)
        const isPredictaStock = predictaStocks.has(row.stockID)
        const isRootForeignStock=rootRelatedStocks.has(row.stockID) && !isPredictaStock

        if (!stockSequence || (!isPredictaStock && !isRootForeignStock)) {
          await logMigrationFault({
            payload,
            type: 'stock-value',
            typeId: row.stockID,
            comments: `Stock value not migrated - isPredictaStock: ${isPredictaStock}, isRootForeignStock: ${isRootForeignStock}`,
            row,
          })
          continue
        }
        await upsertStockValueFromImport( stockSequence, row, req)

        successCount++
        console.log(
          `✓ Inserted stock value: ${row.symbol} (${successCount}/${resultStockValues.recordset.length})`,
        )
      } catch (error) {
        errorCount++
        await logMigrationFault({
          payload,
          type: 'stock-value',
          typeId: row.symbol,
          comments: createStockValueFaultComment({
            stockId: row.symbol,
            error: error instanceof Error ? error : new Error(String(error)),
          }),
          row,
        })
        throw error
      }
    }

    console.log('\nMigration Summary:')
    console.log(`Total records processed: ${resultStockValues.recordset.length}`)
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
