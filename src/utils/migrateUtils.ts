import sql from 'mssql'

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
export async function getStockRelations(pool: sql.ConnectionPool) {
  const stockRelationResult = await pool.request().query(`
      SELECT [Id1], [Id2]
      FROM [dbEmda].[dbo].[tblSecurityIdConnections]
  `)

  console.log(`Retrieved ${stockRelationResult.recordset.length} resultStockIds from SQL Server`)
  const stocks: Map<string,string> = new Map<string, string>
  for (const row of stockRelationResult.recordset) {
    stocks.set(`${row.Id2}`,`${row.Id1}`)
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

