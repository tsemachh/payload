import { BasePayload,  TypeWithID } from 'payload'
import type { Stock } from '@/payload-types'

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

export async function getSeqeunceStockId(payload: BasePayload, stockID: string | null | undefined) {
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
    if (stock.docs.length > 0) id = stock.docs[0].id
  } catch (error) {
    console.error(error)
  }
  return id
}

export async function getSequenceStockValueId(
  payload: BasePayload,
  stockSequence:string,
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
        stockId: { equals: stockSequence},
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
    });
  } catch (error) {
    console.error(`Error finding document in collection ${collectionType}:`, error);
    throw error;
  }
};

export const getIdOfRelationField = (item: TypeWithID | string) => {
  return (typeof item == "string" ? item : item.id)
}
