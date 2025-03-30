import { BasePayload, TypeWithID } from 'payload'
import type { Account, Stock } from '@/payload-types'
import { Column, HoldingTableDate, MeetingTableDataType } from '@/app/(frontend)/types/meetings'
import { StockValue } from '@/payload-types'

export async function getStockIds(stock: Stock) {
  const stockIds: string[] = []
  stockIds.push(stock.id)
  if (stock.relations) {
    stock.relations.docs?.forEach((stock: Stock | string) => {
      stockIds.push(getIdOfRelationField(stock) as string)
    })
  }
  return stockIds
}

export async function getSequenceStockId(payload: BasePayload, stockID: string | null | undefined) {
  const stock = await getStockByStockId(payload, stockID)
  return stock ? stock.id : null
}

export async function getStockByStockId(payload: BasePayload, stockID: string | null | undefined) {
  if (stockID === null) return null

  let id = null

  try {
    const stock = await payload.find({
      collection: 'stocks',
      limit: 1,
      depth: 0,
      where: {
        stockId: { equals: stockID },
      },
    })
    if (stock.docs.length > 0) id = stock.docs[0]
  } catch (error) {
    console.error(error)
  }
  return id
}

export async function getSequenceStockValueId(
  payload: BasePayload,
  stockSequence: string,
  valueDate: string,
) {
  if (stockSequence === null) return null

  let id = null

  try {
    const stock = await payload.find({
      collection: 'stock-values',
      limit: 1,
      depth: 0,
      where: {
        stockId: { equals: stockSequence },
        valueDate: { equals: new Date(valueDate).toISOString() },
      },
    })
    if (stock.docs.length > 0) id = stock.docs[0].id
  } catch (error) {
    console.error(error)
  }
  return id
}

export async function getSequenceMeetingId(payload: BasePayload, meetingId: string | null) {
  if (meetingId === null) return null

  let id = null
  try {
    const data = await payload.find({
      collection: 'meetings',
      limit: 1,
      depth: 0,
      where: {
        meetingId: { equals: meetingId },
      },
    })
    if (data.docs.length > 0) id = data.docs[0].id
  } catch (error) {}
  return id
}

export const getCollectionDoc = async (req: any, collectionType: string, id: string) => {
  try {
    return await req.payload.findByID({
      collection: collectionType,
      id: id,
    })
  } catch (error) {
    console.error(`Error finding document in collection ${collectionType}:`, error)
    throw error
  }
}

export const getIdOfRelationField = (item: TypeWithID | string) => {
  return typeof item == 'string' ? item : item.id
}
export const determineCompanyNameMaxWidth = (
  columns: Column<MeetingTableDataType>[],
  account: HoldingTableDate,
) => {
  const firstValueColumnIndex = columns.findIndex((col) => col.key in account)

  if (firstValueColumnIndex === -1) {
    return '100%'
  }

  const maxWidth = (firstValueColumnIndex - 0.5) * 100 // מספר העמודות עד לעמודה עם הערך כפול רוחב משוער
  console.log('firstValueColumnIndex', firstValueColumnIndex)

  return `${maxWidth}px`
}

export const calculateHoldingValues = (
  account: Account | string,
  quantity: number,
  stockValues: StockValue | null,
) => {
  const holdingsCompanyName = typeof account === 'object' ? account.name : 'Unknown Account'

  const percentageHolding = stockValues?.registeredValue
    ? parseFloat(((quantity / stockValues.registeredValue) * 100).toFixed(2))
    : 0

  const holdingValueInMillions = stockValues?.closingRate
    ? Math.round((quantity * stockValues.closingRate) / 100000000)
    : 0

  return {
    holdingsCompanyName,
    percentageHolding,
    holdingValueInMillions,
    nominalValue: Number(quantity),
  }
}
