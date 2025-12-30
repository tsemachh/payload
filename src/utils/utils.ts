import { BasePayload, CollectionSlug, PayloadRequest, TypeWithID } from 'payload'
import type { AdminNotificationType, Stock } from '@/payload-types'
import { TreeCompanyType } from '@/types/companies'
import { stringify } from 'qs-esm'

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

export async function getStockByStockId(
  payload: BasePayload,
  stockID: string | null | undefined,
  depth: number = 0,
) {
  if (stockID === null) return null

  let id = null

  try {
    const stock = await payload.find({
      collection: 'stocks',
      limit: 1,
      depth: depth,
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
    // Normalize to a UTC day range to avoid strict ISO equality pitfalls
    const d = new Date(valueDate)
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
    const stock = await payload.find({
      collection: 'stock-values',
      limit: 1,
      depth: 0,
      where: {
        and: [
          { stockId: { equals: stockSequence } },
          { valueDate: { greater_than_equal: start.toISOString() } },
          { valueDate: { less_than: end.toISOString() } },
        ],
      },
    })
    if (stock.docs.length > 0) id = stock.docs[0].id
  } catch (error) {
    console.error(error)
  }
  return id
}
export async function getMeetingIdToSequenceMap(payload: BasePayload) {
  const seqMap: Map<string, string> = new Map<string, string>()
  try {
    const data = await payload.find({
      collection: 'meetings',
      limit: 0,
      depth: 0,
      select: {
        primaryLegacyId: true,
        id: true,
      },
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc) => seqMap.set(doc.primaryLegacyId as string, doc.id))
    }
  } catch (error) {
    console.error('Error in query', error)
    throw error
  }
  return seqMap
}

export async function getCompanyIdToSequenceMap(payload: BasePayload) {
  const seqMap: Map<string, string> = new Map<string, string>()
  try {
    const data = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      select: {
        companyId: true,
        id: true,
      },
      where: {
        companyId: {
          not_equals: null,
        },
      },
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc) => seqMap.set(`${doc.companyId}` as string, doc.id as string))
    }
  } catch (error) {
    console.error('Error in query', error)
    throw error
  }
  return seqMap
}

export async function getStockIdToSequenceMap(payload: BasePayload) {
  const seqMap: Map<string, string> = new Map<string, string>()
  try {
    const data = await payload.find({
      collection: 'stocks',
      limit: 0,
      depth: 0,
      select: {
        stockId: true,
        id: true,
      },
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc) => seqMap.set(`${doc.stockId}` as string, doc.id as string))
    }
  } catch (error) {
    console.error('Error in query', error)
    throw error
  }
  return seqMap
}
export async function getCompanyIdToChildCompanies(payload: BasePayload) {
  const seqMap: Map<string, string[]> = new Map<string, string[]>()
  try {
    const data = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      select: {
        companyId: true,
        id: true,
        subCompanies: true,
      },
      where: {
        companyId: {
          not_equals: null,
        },
      },
    })
    if (data.docs.length > 0) {
      data.docs.forEach((doc) =>
        seqMap.set(`${doc.companyId}` as string, doc.subCompanies as string[]),
      )
    }
  } catch (error) {
    console.error('Error in query', error)
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
        primaryLegacyId: { equals: meetingId },
      },
    })
    if (data.docs.length > 0) id = data.docs[0].id
  } catch (error) {}
  return id
}

export const getCollectionDoc = async (req: any, collectionType: string, id: string, depth = 1) => {
  try {
    return await req.payload.findByID({
      collection: collectionType,
      id: id,
      depth: depth,
    })
  } catch (error) {
    console.error(`Error finding document in collection ${collectionType}:`, error)
    throw error
  }
}

export const getIdOfRelationField = (item: TypeWithID | string) => {
  return typeof item == 'string' ? item : typeof item == 'object' ? item?.id : null
}
export const createCompanyOrderMap = (companies: any[]): Map<string, string> => {
  const orderMap = new Map<string, string>()
  companies.forEach((company: any, index: number) => {
    orderMap.set(
      company.id,
      company._order !== undefined ? String(company._order) : String(index).padStart(10, '0'),
    )
  })
  return orderMap
}

/**
 * Gets the parent company ID for a given fund ID
 * @param fundId - The ID of the fund
 * @returns The ID of the parent company, or the fund ID itself if no parent company is found
 */
// Map to store the relationship between fund IDs and their parent company IDs
let fundIdToCompanyIdMap: Map<string, string> = new Map<string, string>()
let mapInitialized = false

/**
 * Preloads the map of fundId -> companyId
 * This function queries all companies of type 'regular' and maps their subCompanies (funds) to the company ID
 * @param payload - The Payload CMS instance
 * @returns A map where the key is the fund ID and the value is the parent company ID
 */
export async function initFundIdToCompanyIdMap(payload: BasePayload): Promise<Map<string, string>> {
  try {
    if (mapInitialized) return fundIdToCompanyIdMap
    // Query all companies of type 'regular'
    const { docs } = await payload.find({
      collection: 'companies',
      limit: 0,
      depth: 0,
      select: {
        id: true,
        subCompanies: true,
      },
      where: {
        type: {
          equals: 'regular',
        },
      },
    })

    // Create a new map
    const newMap = new Map<string, string>()

    // For each company, map its subCompanies (funds) to the company ID
    for (const company of docs) {
      const companyId = company.id
      const subCompanies = company.subCompanies || []

      // Map each subCompany ID (fund ID) to the company ID
      for (const subCompanyId of subCompanies) {
        newMap.set(subCompanyId as string, companyId as string)
      }
    }

    // Update the global map
    fundIdToCompanyIdMap = newMap
    mapInitialized = true

    return fundIdToCompanyIdMap
  } catch (error) {
    console.error('Error initializing fundIdToCompanyIdMap:', error)
    return new Map<string, string>()
  }
}

/**
 * Gets the parent company ID for a given fund ID
 * @param fundId - The ID of the fund
 * @returns The ID of the parent company, or the fund ID itself if no parent company is found
 */
export const getCompanyIdFromFundId = (fundId: string): string | null => {
  // If no fund ID is provided, return an empty string
  if (!fundId) return null

  // If the map is initialized, use it to look up the company ID
  if (mapInitialized && fundIdToCompanyIdMap.has(fundId)) {
    return fundIdToCompanyIdMap.get(fundId) as string
  }

  // If the map is not initialized or the fund ID is not in the map, return null
  return null
}

export function findSubCompanyNameById(
  parentCompany: TreeCompanyType | undefined,
  idToFind: string,
) {
  if (!parentCompany || !Array.isArray(parentCompany.subCompanies)) return null

  const match = parentCompany.subCompanies.find((sub) => sub.id === idToFind)
  return match ? match.name : null
}

/**
 * Creates a new admin notification in the admin-notifications collection
 * @param payload - The Payload CMS instance
 * @param message - The notification message
 * @param type - Type of notification (general, system, user, company, etc.)
 * @param url - Optional URL related to the notification
 * @param companies - Optional ID or IDs of related companies
 * @param relatedUser - Optional ID of the related user
 * @param meeting - Optional ID of the related meeting
 * @returns The created notification or null if there was an error
 */
export async function createAdminNotification(
  req: PayloadRequest,
  message: string,
  type: AdminNotificationType,
  url?: string,
  companies?: string[],
  relatedUser?: string,
  meeting?: string,
) {
  const data = {
    message,
    type,
    url,
    handled: false,
    companies,
    relatedUser,
    meeting,
  }

  try {
    return await req.payload.create({
      collection: 'admin-notifications',
      data,
      req,
    })
  } catch (error) {
    console.error('Error creating admin notification:', error)
    console.error('Error creating admin notification: data', data)
    throw error // Re-throw the error so it can be caught and handled by the caller
  }
}

/**
 * Reverts a draft document to its published version
 * @param req
 * @param collectionSlug - The collection slug (e.g., 'votes')
 * @param documentId - The ID of the document to revert
 * @returns An object with information about the operation result
 */
export async function revertToPublished(
  req: PayloadRequest,
  collectionSlug: string,
  documentId: string,
) {
  try {
    // Step 1: Fetch the published version (without draft=true)
    const publishedDoc = await req.payload.findByID({
      collection: collectionSlug as CollectionSlug,
      id: documentId,
      depth: 0,
      draft: false, // Important: this gets the published version
    })

    if (publishedDoc) {
      // Step 2: Update the document with the published data
      // This creates a new version that matches the published version
      const result = await req.payload.update({
        collection: collectionSlug as CollectionSlug,
        id: documentId,
        data: publishedDoc, // Use the published document data
        draft: true, // Update the draft version
        req,
      })

      return {
        success: true,
        publishedDoc,
        result,
      }
    } else {
      return {
        success: false,
        reason: 'no-published-version',
      }
    }
  } catch (error) {
    console.error(`Error reverting document ${documentId} in collection ${collectionSlug}:`, error)
    return {
      success: false,
      reason: 'error',
      error,
    }
  }
}
