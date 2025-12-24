// In-process cache for active funds and mapping
// Shared between Companies collection hooks and meetings processing

import { Payload } from 'payload'

export function getCompanyIdFromFundId(fundId: string): string | null {
  const map = getFundToCompanyMap()
  if (!map) return null
  const key = String(fundId)
  return map[key] || null
}

export function getCompanyFundIds(companyId: string): string[] | null {
  if (!companyId) return null
  const map = __activeFundsCache?.companyToFunds
  if (!map) return null
  const key = String(companyId)
  return map[key] || null
}

type ActiveFundsCache = {
  ids: string[]
  // map of companyId -> array of fundIds
  companyToFunds: Record<string, string[]>
  // map of fundId -> companyId
  fundToCompany: Record<string, string>
} | null

let __activeFundsCache: ActiveFundsCache = null

export function setActiveFundsCache(
  ids: string[],
  companyToFunds?: Record<string, string[]>,
  fundToCompany?: Record<string, string>,
) {
  const uniqueIds = Array.from(new Set(ids)).map(String)
  __activeFundsCache = {
    ids: uniqueIds,
    companyToFunds: companyToFunds || {},
    fundToCompany: fundToCompany || {},
  }
}

export function getActiveFundsCache(): string[] | null {
  if (!__activeFundsCache) return null
  return __activeFundsCache.ids
}

export function getCompanyToFundsMap(): Record<string, string[]> | null {
  if (!__activeFundsCache) return null
  return __activeFundsCache.companyToFunds || {}
}

export function getFundToCompanyMap(): Record<string, string> | null {
  if (!__activeFundsCache) return null
  return __activeFundsCache.fundToCompany || {}
}

export function requireFundToCompanyMap(): Record<string, string> {
  const m = getFundToCompanyMap()
  if (!m) throw new Error('Active funds cache not initialized: fundToCompany map is unavailable')
  return m
}

export function companyIdFromFundIdStrict(fundId: string): string {
  const f2c = requireFundToCompanyMap()
  const cid = f2c[String(fundId)]
  if (!cid) throw new Error(`Active funds cache missing company mapping for fund ${fundId}`)
  return cid
}

// --- Loader: Preload the cache using Payload API only ---
export async function preloadFundsCache(payload: Payload) {
  if (!payload) throw new Error('preloadFundsCache requires payload instance')

  try {
    // Use Payload's official API
    const res = await (payload as any).find({
      collection: 'companies',
      where: { type: { equals: 'fund' }, active: { equals: true } },
      select: { id: true, parentCompany: true },
      pagination: false,
      limit: 0,
      depth: 0,
    })

    const docs: any[] = Array.isArray(res?.docs) ? res.docs : []

    const ids = Array.from(new Set(docs.map((d: any) => String(d.id))))
    const fundToCompany: Record<string, string> = {}
    const companyToFunds: Record<string, string[]> = {}

    for (const d of docs) {
      const fundId = String(d.id)
      const companyId = d?.parentCompany ? String(d.parentCompany) : ''
      if (companyId) {
        fundToCompany[fundId] = companyId
        if (!companyToFunds[companyId]) companyToFunds[companyId] = []
        companyToFunds[companyId].push(fundId)
      }
    }

    setActiveFundsCache(ids, companyToFunds, fundToCompany)
  } catch (e) {
    console.error('preloadFundsCache', e)
    throw e
  }
}

// Allow invalidation to optionally reload immediately when given payload
export async function invalidateActiveFundsCache(payload?: any): Promise<void> {
  if (payload) {
    try {
      await preloadFundsCache(payload)
    } catch (e) {
      console.error('preloadFundsCache', e)
      // swallow errors on background reload
    }
  }
}
