import { BasePayload, TypeWithID } from 'payload'
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
export async function getMeetingIdToSequenceMap(payload: BasePayload) {
  const seqMap:Map<string,string> = new Map<string,string>()
  try {
    const data = await payload.find({
      collection: 'meetings',
      limit: 0,
      depth: 0,
      select: {
        meetingId: true,
        id: true
      },
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc)=>seqMap.set(doc.meetingId as string,doc.id))
    }
  } catch (error) {
    console.error("Error in query",error)
    throw error
  }
  return seqMap
}

export async function getCompanyIdToSequenceMap(payload: BasePayload) {
  const seqMap:Map<string,string> = new Map<string,string>()
  try {
    const data = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      select: {
        companyId: true,
        id: true,
      },
      where:{
        companyId:{
          not_equals:null
        }
      }
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc)=>seqMap.set(`${doc.companyId}` as string,doc.id as string))
    }
  } catch (error) {
    console.error("Error in query",error)
    throw error
  }
  return seqMap
}

export async function getStockIdToSequenceMap(payload: BasePayload) {
  const seqMap:Map<string,string> = new Map<string,string>()
  try {
    const data = await payload.find({
      collection: 'stocks',
      limit: 0,
      depth: 0,
      select: {
        stockId: true,
        id: true,
      }
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc)=>seqMap.set(`${doc.stockId}` as string,doc.id as string))
    }
  } catch (error) {
    console.error("Error in query",error)
    throw error
  }
  return seqMap
}
export async function getCompanyIdToChildCompanies(payload: BasePayload) {
  const seqMap:Map<string,string[]> = new Map<string,string[]>()
  try {
    const data = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      select: {
        companyId: true,
        id: true,
        subCompanies:true
      },
      where:{
        companyId:{
          not_equals:null
        }
      }
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc)=>seqMap.set(`${doc.companyId}` as string,doc.subCompanies as string[]))
    }
  } catch (error) {
    console.error("Error in query",error)
    throw error
  }
  return seqMap
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
