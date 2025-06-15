import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { StockType } from '@/payload-types'
import { upsertStockFromImport } from '@/utils/migrateUtils'
import { getSequenceStockId } from '@/utils/utils'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import ImportStock from '@/collections/stocks/imports/ImportStock'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting foreign stocks migration process...')
    // Create a map of stockId -> isin
    const stockToIsinMap = new Map<string, string>()
    const foreignStocksData = await payload.find({
      collection: 'stock-migration-mapping',
      where: {
        type: {
          equals: 'Foreign',
        },
      },
      limit: 1000,
    })

    // Build the stockId -> isin mapping
    for (let i = 0; i < foreignStocksData.docs.length; i++) {
      const doc = foreignStocksData.docs[i]
      stockToIsinMap.set(`${doc.stockId}`, doc.isin as string)
    }
    console.log('Isin', JSON.stringify(stockToIsinMap))

    const foreignStocks = await payload.find({
      collection: 'stocks',
      where: {
        origin: {
          equals: 'Foreign',
        },
      },
      limit: 1000,
    })
    console.log('foreignStocks.docs.length', foreignStocks.docs.length)
    // Process each foreign stock
    for (const originalStock of foreignStocks.docs) {
      try {
        const isin = stockToIsinMap.get(`${originalStock.stockId}`)
        if (!isin) {
          await logMigrationFault({
            payload,
            type: 'stock',
            typeId: `${originalStock.stockId}`,
            comments: `No ISIN found for foreign stock ${originalStock.stockId}`,
          })
          continue
        }
        // Check if a stock with this ISIN already exists
        let newStockSequence = await getSequenceStockId(payload, isin)
        if (!newStockSequence) {
          // Create or update the ISIN stock
          newStockSequence = (await upsertStockFromImport(
            null,
            {
              stockID: isin,
              name: originalStock.name as string,
              symbol: originalStock.symbol as string,
              type: originalStock.type as StockType,
              longName: originalStock.longName as string,
            } as ImportStock,
            req,
            true, // tradable
            'Foreign', // origin
            true, // active
            `Created from foreign stock ${originalStock.stockId}`,
          )) as string | null
        }

        // Update the original stock to point to the new ISIN stock
        if (newStockSequence) {
          req.payload.update({
            collection: 'stocks',
            id: originalStock.id,
            data: {
              relatedStock: newStockSequence,
              tradable: false,
            },
          })
          // Update all stocks that had this stock as related to point to the new ISIN stock
          req.payload.update({
            collection: 'stocks',
            data: {
              tradable: false,
              origin: 'Foreign',
              active: true,
              relatedStock: newStockSequence,
            },
            where: {
              relatedStock: {
                equals: originalStock.id,
              },
            },
          })
          req.payload.update({
            collection: 'meetings',
            data: {
              stock: newStockSequence,
            },
            where: {
              stock: {
                equals: originalStock.id,
              },
            },
          })
          console.log(`Successfully processed stock ${originalStock.stockId} with ISIN ${isin}`)
        }
      } catch (error) {
        await logMigrationFault({
          payload,
          type: 'stock',
          comments: `Failed to process foreign stock ${originalStock.stockId}: ${JSON.stringify(error)}`,
          typeId: originalStock.stockId,
        })
      }
    }

    console.log('Foreign stocks migration completed successfully')
  } catch (error) {
    console.error('Error during foreign stocks migration:', error)
    throw error
  }
}
