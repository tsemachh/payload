import { BasePayload } from 'payload'

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
