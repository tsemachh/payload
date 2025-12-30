// In-process cache for active funds and mapping
// Shared between Companies collection hooks and meetings processing

import { Payload } from 'payload'

// Minimal company shape we want to cache and expose
export type CachedCompany = {
  id: string
  name: string | null
  parentCompany: string | null
  _order: string | null
  passiveFund: boolean | null
  type: string | null
}

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

type ActiveCompaniesCache = {
  ids: string[]
  // map of companyId -> array of fundIds
  companyToFunds: Record<string, string[]>
  // map of fundId -> companyId
  fundToCompany: Record<string, string>
  // map of any company id -> minimal cached data
  byId: Record<string, CachedCompany>
} | null

let __activeFundsCache: ActiveCompaniesCache = null

export function setActiveFundsCache(
  ids: string[],
  companyToFunds?: Record<string, string[]>,
  fundToCompany?: Record<string, string>,
  byId?: Record<string, CachedCompany>,
) {
  const uniqueIds = Array.from(new Set(ids)).map(String)
  __activeFundsCache = {
    ids: uniqueIds,
    companyToFunds: companyToFunds || {},
    fundToCompany: fundToCompany || {},
    byId: byId || {},
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

// --- New getters for standardized access to cached company data ---
export function getCompanyDataById(id: string): CachedCompany | null {
  if (!id) return null
  if (!__activeFundsCache) return null
  return __activeFundsCache.byId[String(id)] || null
}

export function getRegularCompanies(): CachedCompany[] {
  if (!__activeFundsCache) return []
  return Object.values(__activeFundsCache.byId).filter(company => company.type === 'regular')
}

export function getCompanyNameById(id: string): string | null {
  return getCompanyDataById(id)?.name ?? null
}

export function getCompanyNamesByIds(ids: string[]): Array<{ id: string; name: string | null }> {
  return ids.map((id) => ({ id, name: getCompanyNameById(id) }))
}

export function getManyCompanyDataByIds(ids: string[]): Record<string, CachedCompany | null> {
  const res: Record<string, CachedCompany | null> = {}
  for (const id of ids || []) res[String(id)] = getCompanyDataById(String(id))
  return res
}

// Alias with clearer name as requested
export const getByIds = (ids: string[]): Record<string, CachedCompany | null> =>
  getManyCompanyDataByIds(ids)

// --- Loader: Preload the cache using Payload API only ---
export async function preloadCompaniesCache(payload: Payload) {
  if (!payload) throw new Error('preloadCompaniesCache requires payload instance')

  try {
    // Use Payload's official API
    const res = await (payload as any).find({
      collection: 'companies',
      // Load all active companies of any type so byId contains funds, regular, and parent
      where: { active: { equals: true } },
      select: {
        id: true,
        name: true,
        parentCompany: true,
        _order: true,
        passiveFund: true,
        // we need type only for filtering activeFunds ids and maps; we don't expose it in CachedCompany
        type: true,
      },
      pagination: false,
      limit: 0,
      depth: 0,
    })

    const docs: any[] = Array.isArray(res?.docs) ? res.docs : []

    // Only funds go to ids; byId will include all active companies
    const ids: string[] = []
    const fundToCompany: Record<string, string> = {}
    const companyToFunds: Record<string, string[]> = {}
    const byId: Record<string, CachedCompany> = {}

    for (const d of docs) {
      const anyId = String(d.id)
      const companyId = d?.parentCompany ? String(d.parentCompany) : ''
      // populate byId for every active company (fund/regular/parent)
      byId[anyId] = {
        id: anyId,
        name: d?.name ?? null,
        parentCompany: companyId || null,
        _order: typeof d?._order === 'string' ? d._order : null,
        passiveFund: typeof d?.passiveFund === 'boolean' ? d.passiveFund : null,
        type: typeof d?.type === 'string' ? d.type : null,
      }

      // Build active funds ids and maps only for fund-type docs
      if (d?.type === 'fund') {
        const fundId = anyId
        ids.push(fundId)
        if (companyId) {
          fundToCompany[fundId] = companyId
          if (!companyToFunds[companyId]) companyToFunds[companyId] = []
          companyToFunds[companyId].push(fundId)
        }
      }
    }

    setActiveFundsCache(ids, companyToFunds, fundToCompany, byId)
  } catch (e) {
    console.error('preloadCompaniesCache', e)
    throw e
  }
}

// Allow invalidation to optionally reload immediately when given payload
export async function invalidateActiveFundsCache(payload?: any): Promise<void> {
  if (payload) {
    try {
      await preloadCompaniesCache(payload)
    } catch (e) {
      console.error('preloadCompaniesCache', e)
      // swallow errors on background reload
    }
  }
}
