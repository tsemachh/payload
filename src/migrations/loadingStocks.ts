import * as dotenv from 'dotenv'
import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-mongodb'
import stocksData from '../data/stocksData.json'

dotenv.config()

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const clearstocksCollection = async () => {
    try {
      await payload.delete({
        collection: 'stocks',
        where: {},
      })
      console.log('Cleared stocks collection.')
    } catch (error) {
      console.error('Failed to clear stocks collection:', error)
    }
  }

  const importstocks = async () => {
    try {
      const jsonData = stocksData

      for (const item of jsonData) {
        const stockData = {
          typeId: item["מס' נייר ערך"],
          name: item['שם'],
          symbol: item['סימול'],
          sector: item['סוג'],
          close: item['שער סגירה'],
          marketValue: item['ערך שוק'],
          registeredValue: item['ערך רשום'],
          company: item['שם'],
          //   date: new Date(),
          //   open: 0,
          //   high: 0,
          //   low: 0,
          //   volume: 0,
          //   change: 0,
          //   turnover: 0,
        }

        try {
          await payload.create({
            collection: 'stocks',
            data: stockData as any,
          })

          console.log(`Created stock: ${stockData.name}`)
        } catch (error) {
          console.error(`Failed to create stock: ${stockData.name}`, error)
        }
      }
    } catch (error) {
      console.error('Error during import:', error)
    }
  }

  await clearstocksCollection()
  await importstocks()
}

export async function down({}: MigrateDownArgs): Promise<void> {
  console.log('No rollback functionality provided for this migration.')
}

export const Migrationstocks = {
  name: 'Migrationstocks',
  up: up,
  down: down,
}
