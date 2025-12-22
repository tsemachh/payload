// In-process cache for active fund IDs
// Shared between Companies collection hooks and meetings processing

let __activeFundsCache: { ids: string[]; updatedAt: number } | null = null

// Default TTL: 15 minutes; can be adjusted via env ACTIVE_FUNDS_TTL_MS
const DEFAULT_TTL = 15 * 60 * 1000
const TTL_MS = Number(process.env.ACTIVE_FUNDS_TTL_MS || DEFAULT_TTL)

export function setActiveFundsCache(ids: string[]) {
  __activeFundsCache = { ids: Array.from(new Set(ids)).map(String), updatedAt: Date.now() }
}

export function getActiveFundsCache(): string[] | null {
  if (!__activeFundsCache) return null
  if (Date.now() - __activeFundsCache.updatedAt > TTL_MS) return null
  return __activeFundsCache.ids
}

export function invalidateActiveFundsCache() {
  __activeFundsCache = null
}
