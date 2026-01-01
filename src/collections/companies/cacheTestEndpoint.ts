import { addDataAndFileToRequest, PayloadRequest } from 'payload'

// Moved from Companies.ts to a dedicated file for clarity and reuse
const cacheTestEndpoint = async (req: PayloadRequest) => {
  try {
    // Align with details endpoint behavior
    await addDataAndFileToRequest(req)

    // Lazy import to avoid circulars at module load time
    const {
      getActiveFundsCache,
      getCompanyDataById,
      getCompanyNameById,
      getManyCompanyDataByIds,
      getCompanyIdFromFundId,
      getCompanyFundIds,
      invalidateActiveFundsCache,
    } = await import('@/collections/meetings/hooks/activeCompaniesCache')

    const q = (req?.query || {}) as Record<string, any>

    // Optional refresh trigger
    const refresh = String(q.refresh || '').toLowerCase() === 'true'
    if (refresh && req?.payload) {
      try {
        await invalidateActiveFundsCache(req.payload)
      } catch {}
    }

    // Parse ids (comma-separated supported)
    const idParam = q.id
    const ids = Array.isArray(idParam)
      ? idParam.map(String)
      : typeof idParam === 'string' && idParam.length > 0
        ? String(idParam)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []

    const includeActiveFunds = String(q.includeActiveFunds || '').toLowerCase() === 'true'
    const fundId = q.fundId ? String(q.fundId) : ''
    const companyId = q.companyId ? String(q.companyId) : ''

    const byId = ids.length > 0 ? getManyCompanyDataByIds(ids, req.payload) : {}
    const namesOnly =
      ids.length > 0
        ? ids.reduce<Record<string, string | null>>((acc, id) => {
            acc[id] = getCompanyNameById(id, req.payload)
            return acc
          }, {})
        : {}

    const resolvedCompanyFromFund = fundId ? getCompanyIdFromFundId(fundId, req.payload) : null
    const resolvedFundsFromCompany = companyId ? getCompanyFundIds(companyId, req.payload) : null

    const payloadJson: any = {
      params: {
        ids,
        fundId: fundId || undefined,
        companyId: companyId || undefined,
        includeActiveFunds,
        refresh,
      },
      results: {
        byId,
        namesOnly,
        resolvedCompanyFromFund,
        resolvedFundsFromCompany,
      },
    }

    if (includeActiveFunds) {
      payloadJson.results.activeFunds = getActiveFundsCache(req.payload) || []
    }

    // Always include maps for visibility when debugging
    try {
      const { getCompanyToFundsMap, getFundToCompanyMap } = await import(
        '@/collections/meetings/hooks/activeCompaniesCache'
      )
      payloadJson.results.companyToFunds = getCompanyToFundsMap(req.payload) || {}
      payloadJson.results.fundToCompany = getFundToCompanyMap(req.payload) || {}
    } catch {}

    return Response.json(payloadJson)
  } catch (e: any) {
    req?.payload?.logger?.error?.({ e }, 'companies/cache-test failed')
    return Response.json({ error: 'cache-test failed', message: e?.message }, { status: 500 })
  }
}

export default cacheTestEndpoint
