import sql from 'mssql'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { Stock, StockValue, StockOrigin } from '@/payload-types'
import { getSequenceStockValueId } from '@/utils/utils'
import { Payload, PayloadRequest } from 'payload'
import { logMigrationFault } from './migrationFaultUtils'

export async function getSqlConnection(): Promise<sql.ConnectionPool> {
  const pool = await sql.connect({
    user: 'emda',
    password: 'Aa123456',
    database: 'dbEmda',
    server: '10.0.0.9',
    options: {
      encrypt: true
    }
  })
  return pool
}

export async function getStocks(pool: sql.ConnectionPool) {
  const resultStocks = await pool.request().query(`
      SELECT DISTINCT [stockID]
                    , [name]
                    , [symbol]
                    , [type]
                    , [longName]
      FROM [dbEmda].[dbo].[stocks]
      ORDER BY stockID
  `)
  console.log(`Retrieved ${resultStocks.recordset.length} records from SQL Server`)
  return resultStocks
}

export async function getStockValues(pool: sql.ConnectionPool) {
  // Query the last 30 days of data
  console.log('Executing SQL query for last 30 days of stock data...')
  const resultStockValues = await pool.request().query(`
        SELECT stockID,
               name,
               symbol,
               type,
               closingRate,
               marketValue,
               registeredValue,
               valueDate,
               logUpdateID,
               longName
        FROM [dbEmda].[dbo].[stocks]
        WHERE [valueDate] >= DATEADD(DAY, -30, GETDATE())
        ORDER BY valueDate ASC;
    `)
  console.log(`Retrieved ${resultStockValues.recordset.length} records from SQL Server`)
  return resultStockValues
}
export async function getPredictaStockIds(pool: sql.ConnectionPool) {
  return getStockIdsByUpdateId(pool, await getLatestStockPredictaLogId(pool))
}

export async function getEmdaStockIds(pool: sql.ConnectionPool) {
  return getStockIdsByUpdateId(pool, await getLatestStockEmdaLogId(pool))
}

export async function getStockIdsByUpdateId(pool: sql.ConnectionPool, logUpdateId: string) {
  const resultStockIds = await pool.request().query(`
      SELECT distinct [stockID]
      FROM [dbEmda].[dbo].[stocks] stocks
      WHERE stocks.logUpdateID = ${logUpdateId}
  `)

  console.log(`Retrieved ${resultStockIds.recordset.length} resultStockIds from SQL Server`)
  const stocks: Set<string> = new Set()
  for (const row of resultStockIds.recordset) {
    stocks.add(`${row.stockID}`)
  }
  return stocks
}
export async function getStockRelations(pool: sql.ConnectionPool, payload: Payload) {
  const stockRelationResult = await pool.request().query(`
      SELECT [Id1], [Id2]
      FROM [dbEmda].[dbo].[tblSecurityIdConnections]
  `)

  console.log(`Retrieved ${stockRelationResult.recordset.length} resultStockIds from SQL Server`)
  const stocks: Map<string, string> = new Map<string, string>()
  for (const row of stockRelationResult.recordset) {
    const id1 = `${row.Id1}`
    const id2 = `${row.Id2}`

    if (!stocks.has(id2))
      stocks.set(id2, id1)
    else {
      await logMigrationFault({
        payload,
        type: 'stock-relation',
        typeId: id2,
        row:JSON.stringify(row,null,2),
        comments: `Multiple relation: ${id2} has already relation to ${stocks.get(id2)}, so ${id2}->${id1} will not be inserted`,
      })
    }
  }
  return stocks
}

export async function getLatestStockLogIdByUserId(pool: sql.ConnectionPool, userId: number) {
  const res = await pool.request().query(`
      SELECT TOP(1)[id]
      FROM [dbEmda].[dbo].[stockupdatelog]
      WHERE userID = ${userId}
      ORDER BY id DESC    `)
  if (res.recordset.length === 0) {
    throw new Error('No records found for userID = 0')
  }
  const id = res.recordset[0].id
  return id
}

export async function getLatestStockEmdaLogId(pool: sql.ConnectionPool) {
  return getLatestStockLogIdByUserId(pool, 61)
}

export async function getLatestStockPredictaLogId(pool: sql.ConnectionPool) {
  return getLatestStockLogIdByUserId(pool, 0)
}

export async function getAllStocksInMeetings(pool: sql.ConnectionPool) {
  const res = await pool.request().query(`
      SELECT distinct [stockID]
      FROM [dbEmda].[dbo].[meetings]   `)
  const stocks: Set<string> = new Set()
  for (const row of res.recordset) {
    stocks.add(`${row.stockID}`)
  }
  return stocks
}

export function ImportedRowToStock(row: ImportStock) {}

export type StockMappingType = 'NotActive' | 'NonTradable' | 'Private' | 'Foreign';

export async function getStockIdsByMappingType(payload: Payload, type: StockMappingType): Promise<Set<string>> {
  const result = await payload.find({
    collection: 'stock-migration-mapping',
    where: {
      type: {
        equals: type
      }
    },
    limit: 1000,
  });

  console.log(`Retrieved ${result.docs.length} ${type.toLowerCase()} stocks from stock migration mapping`);
  const stocks: Set<string> = new Set();
  for (const doc of result.docs) {
    stocks.add(`${doc.stockId}`);
  }
  return stocks;
}

export async function upsertStockFromImport(
  stockSequence: string | null,
  row: ImportStock,
  req: PayloadRequest,
  tradable: boolean,
  origin: StockOrigin  = "TASE",
  active: boolean | null = true,
  comments:string =""
) {

  const stockData: Partial<Stock> = {
    active : active,
    stockId: `${row.stockID}`,
    name: row.name || null,
    symbol: row.symbol || null,
    type: row.type || null,
    longName: row.longName || null,
    tradable: tradable as boolean | null,
    origin: origin,
    comments
  }

  if (!stockSequence) {
    // Insert into Payload CMS
    const newStock = await req.payload.create({
      collection: 'stocks',
      data: stockData as Stock,
    })
    stockSequence = newStock.id
  } else {
    await req.payload.update({
      collection: 'stocks',
      id: stockSequence,
      data: stockData as Stock,
    })
  }
  return stockSequence
}

export async function upsertStockValueFromImport(
  stockSequence: string,
  row: ImportStock,
  req: PayloadRequest,
) {
  const stockValue: Partial<StockValue> | null = {
    stockId: stockSequence as string,
    valueDate: row.valueDate,
    closingRate: row.closingRate || null,
    marketValue: row.marketValue || null,
    registeredValue: row.registeredValue || null,
  }

  const valueId = await getSequenceStockValueId(req.payload, stockSequence, row.valueDate)
  if (valueId) {
    // Update Payload CMS
    req.payload.update({
      collection: 'stock-values',
      id: valueId,
      data: stockValue as StockValue,
    })
  } else {
    // Insert into Payload CMS
    req.payload.create({
      collection: 'stock-values',
      data: stockValue as StockValue,
    })
  }
}
