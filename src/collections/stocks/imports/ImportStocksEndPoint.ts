import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import ImportStock from '@/collections/stocks/imports/ImportStock'
import { getStockByStockId } from '@/utils/utils'

import { upsertStockFromImport, upsertStockValueFromImport } from '@/utils/migrateUtils'

const ImportStocksEndPoint = async (req: PayloadRequest) => {
  await addDataAndFileToRequest(req)
  if (req === null) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!req.user) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  // @ts-expect-error req not null
  const data = await req.json()
  const rows: ImportStock[] = data as ImportStock[]
  console.log('Stocks', JSON.stringify(rows))
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const stock = await getStockByStockId(req.payload, `${row.stockID}` as string)
    const stockSequence = await upsertStockFromImport(stock, row, req, true)
    await upsertStockValueFromImport(stockSequence, row, req)
  }

  return Response.json({
    message: 'successfully updated rows info , total:'+rows.length+" rows",
  })
}

export default ImportStocksEndPoint
