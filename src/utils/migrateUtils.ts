import sql from 'mssql'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { Stock, StockOrigin, StockValue } from '@/payload-types'
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
      encrypt: true,
    },
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
  console.log(`getStocks - Retrieved ${resultStocks.recordset.length} records from SQL Server`)
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
      WHERE [valueDate] >= DATEADD(DAY, -90, GETDATE())
      ORDER BY valueDate ASC;
  `)
  console.log(`Retrieved ${resultStockValues.recordset.length} records from SQL Server`)
  return resultStockValues
}

export async function getPredictaStockIds(pool: sql.ConnectionPool) {
  return getStockIdsByUpdateId(pool, await getLatestStockPredictaLogId(pool))
}

export async function getHistoryPredictaStockIds(pool: sql.ConnectionPool) {
  return getStockIdsByUpdateIds(pool, await getAllStockPredictaLogId(pool))
}

export async function getEmdaStockIds(pool: sql.ConnectionPool) {
  return getStockIdsByUpdateId(pool, await getLatestStockEmdaLogId(pool))
}

export async function getStockIdsByUpdateIds(pool: sql.ConnectionPool, logUpdateIds: string[]) {
  // Handle empty array case
  if (logUpdateIds.length === 0) {
    return new Set<string>()
  }

  // Validate each logUpdateId in the array
  for (let i = 0; i < logUpdateIds.length; i++) {
    const id = logUpdateIds[i];
    if (!id || typeof id !== 'string') {
      throw new Error(`Invalid logUpdateId at index ${i}: ${id}. Expected a non-empty string.`)
    }
  }

  const request = pool.request()

  // Create parameterized query with multiple parameters
  const paramNames = logUpdateIds.map((_, i) => `@logUpdateId${i}`)
  const inClause = `(${paramNames.join(',')})`

  // Add parameters to the request
  logUpdateIds.forEach((id, i) => {
    request.input(`logUpdateId${i}`, sql.VarChar, id)
  })

  const resultStockIds = await request.query(`
      SELECT distinct [stockID]
      FROM [dbEmda].[dbo].[stocks] stocks
      WHERE stocks.logUpdateID in ${inClause}
  `)

  console.log(`getStockIdsByUpdateIds- Retrieved ${resultStockIds.recordset.length} resultStockIds from SQL Server`)
  const stocks: Set<string> = new Set()
  for (const row of resultStockIds.recordset) {
    stocks.add(`${row.stockID}`)
  }
  return stocks
}

export async function getStockIdsByUpdateId(pool: sql.ConnectionPool, logUpdateId: string) {
  if (!logUpdateId || typeof logUpdateId !== 'string') {
    throw new Error(`Invalid logUpdateId: ${logUpdateId}. Expected a non-empty string.`)
  }

  const request = pool.request()
  request.input('logUpdateId', sql.VarChar, logUpdateId)
  const resultStockIds = await request.query(`
      SELECT distinct [stockID]
      FROM [dbEmda].[dbo].[stocks] stocks
      WHERE stocks.logUpdateID = @logUpdateId
  `)

  console.log(`getStockIdsByUpdateId Retrieved ${resultStockIds.recordset.length} resultStockIds from SQL Server`)
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

    if (!stocks.has(id2)) stocks.set(id2, id1)
    else {
      await logMigrationFault({
        payload,
        type: 'stock-relation',
        typeId: id2,
        row: JSON.stringify(row, null, 2),
        comments: `Multiple relation: ${id2} has already relation to ${stocks.get(id2)}, so ${id2}->${id1} will not be inserted`,
      })
    }
  }
  return stocks
}

export async function getLatestStockLogIdByUserId(pool: sql.ConnectionPool, userId: number): Promise<string> {
  const request = pool.request()
  request.input('userId', sql.Int, userId)
  const res = await request.query(`
      SELECT TOP (1) [id]
      FROM [dbEmda].[dbo].[stockupdatelog]
      WHERE userID = @userId
      ORDER BY id DESC    `)
  if (res.recordset.length === 0) {
    throw new Error(`No records found for userID = ${userId}`)
  }
  const id = res.recordset[0].id

  // Ensure the id is a valid string
  if (id === null || id === undefined) {
    throw new Error(`Invalid id returned for userID = ${userId}. ID cannot be null or undefined.`)
  }

  // Convert to string if it's not already
  return `${id}`
}

export async function getAllStockLogIdByUserId(pool: sql.ConnectionPool, userId: number): Promise<string[]> {
  const request = pool.request()
  request.input('userId', sql.Int, userId)
  const res = await request.query(`
      SELECT [id]
      FROM [dbEmda].[dbo].[stockupdatelog]
      WHERE userID = @userId
      ORDER BY id DESC    `)
  if (res.recordset.length === 0) {
    throw new Error(`No records found for userID = ${userId}`)
  }

  // Map each record.id to a string, filtering out any null or undefined values
  return res.recordset
    .map((record) => record.id)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => `${id}`)
}

export async function getLatestStockEmdaLogId(pool: sql.ConnectionPool) {
  return getLatestStockLogIdByUserId(pool, 61)
}

export async function getLatestStockPredictaLogId(pool: sql.ConnectionPool) {
  return getLatestStockLogIdByUserId(pool, 0)
}

export async function getAllStockEmdaLogId(pool: sql.ConnectionPool) {
  return getAllStockLogIdByUserId(pool, 61)
}

export async function getAllStockPredictaLogId(pool: sql.ConnectionPool) {
  return getAllStockLogIdByUserId(pool, 0)
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

export async function getAllStocksInLatestMeetings(pool: sql.ConnectionPool) {
  const res = await pool.request().query(`
      SELECT distinct [stockID]
      FROM [dbEmda].[dbo].[meetings] WHERE mdate >= '2024-01-01'  `)
  const stocks: Set<string> = new Set()
  for (const row of res.recordset) {
    stocks.add(`${row.stockID}`)
  }
  return stocks
}
export function ImportedRowToStock(row: ImportStock) {}

export type StockMappingType = 'NotActive' | 'NonTradable' | 'Private' | 'Foreign'

export async function getStockIdsByMappingType(
  payload: Payload,
  type: StockMappingType,
): Promise<Set<string>> {
  const result = await payload.find({
    collection: 'stock-migration-mapping',
    where: {
      type: {
        equals: type,
      },
    },
    limit: 1000,
  })

  console.log(
    `Retrieved ${result.docs.length} ${type.toLowerCase()} stocks from stock migration mapping`,
  )
  const stocks: Set<string> = new Set()
  for (const doc of result.docs) {
    stocks.add(`${doc.stockId}`)
  }
  return stocks
}

export async function upsertStockFromImport(
  stock: Stock | null,
  row: ImportStock,
  req: PayloadRequest,
  tradable: boolean,
  origin: StockOrigin = 'TASE',
  active: boolean | null = true,
  comments: string = '',
  fromMagna: boolean = false,
) {
  const stockData: Partial<Stock> = {
    active: active,
    stockId: `${row.stockID}`,
    name: row.name || null,
    symbol: row.symbol || null,
    type: row.type || null,
    longName: row.longName || null,
    tradable: tradable as boolean | null,
    origin: origin,
    comments: comments,
    fromMagna: fromMagna
  }
  try {
    if (!stock) {
      // Insert into Payload CMS
      const newStock = await req.payload.create({
        collection: 'stocks',
        data: stockData as Stock,
        req,
      })
      return newStock.id
    } else {
      //Update the Stock only if name or longName have changed
      if (
        stock.name != stockData.name ||
        stock.active != stockData.active ||
        stock.comments != stockData.comments ||
        (stockData.longName && stock.longName != stockData.longName)
      ) {
        await req.payload.update({
          collection: 'stocks',
          id: stock.id,
          data: { name: stockData.name, longName: stockData.longName },
          req,
        })
      }
      return stock.id
    }
  }
  catch(error:any){
    console.error(
      `Error processing stock ${stockData?.stockId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error,
    )
    // Don't rethrow the error to allow other stocks to be processed
  }
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
      req,
    })
  } else {
    // Insert into Payload CMS
    req.payload.create({
      collection: 'stock-values',
      data: stockValue as StockValue,
      req,
    })
  }
}

/**
 * Creates a map of stocks with stockId as the key and the stock object as the value
 * @param req PayloadRequest object
 * @param origin Origin of the stocks to fetch (default: "TASE")
 * @returns Map of stocks with stockId as the key and the stock object as the value
 */
export async function createStocksMap(
  req: PayloadRequest,
  origin: StockOrigin = 'TASE',
): Promise<Map<string, Stock>> {
  const stockMap: Map<string, Stock> = new Map()
  const stocksResult = await req.payload.find({
    collection: 'stocks',
    where: {
      origin: { equals: origin },
      tradable: { equals: true },
    },
    depth: 0,
    limit: 0,
    req,
  })
  stocksResult.docs.forEach((stock: Stock) => {
    const stockKey = stock?.stockId
    stockMap.set(stockKey, stock)
  })
  return stockMap
}
