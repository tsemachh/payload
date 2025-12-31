import { PayloadRequest, Where } from 'payload'
import type { FundWithHolding, HistoricalHolding, HoldingsPerDay, Meeting } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'
import { initPerformanceContext, PerfTimer } from '@/collections/meetings/hooks/perfTimer'
import {
  getActiveFundsCache,
  getCompanyIdFromFundId,
  getCompanyToFundsMap,
  getFundToCompanyMap,
} from '@/collections/meetings/hooks/activeCompaniesCache'

// Historical fetch strategy v2:
// Iterate company-by-company; for each company, determine its funds and query holdings
// limited to those funds with limit:1, sorted by -valueDate. This narrows scans and
// lets us early-stop per company quickly.
async function fetchHistoricalHoldings(
  req: PayloadRequest,
  meeting: Meeting,
  companiesToCheck: string[],
  mt?: PerfTimer,
) {
  // 30 days lookback window relative to meeting.holdingsLimit
  const historicalDate = new Date(meeting.holdingsLimit as string)
  historicalDate.setDate(historicalDate.getDate() - 30)
  const historicalDateStr = historicalDate.toISOString()

  // Pull mapping from cache to avoid extra queries
  const cachedMap = getCompanyToFundsMap() || {}

  debugger
  const stockId = String(getIdOfRelationField(meeting.stock))
  const results: any[] = []

  // Process company by company; for each, query only its funds and limit to 1 newest doc
  // Use paging batch size as a soft concurrency limiter per loop (sequential here for simplicity)
  for (const companyId of companiesToCheck) {
    const companyFunds = cachedMap[companyId] || []
    if (!companyFunds.length) continue

    mt?.start('query.holdings.historical')
    const res = await req.payload.find({
      collection: 'holdings',
      depth: 0,
      pagination: false,
      limit: 1,
      select: { fund: true, valueDate: true, holdings: true },
      where: {
        and: [
          { valueDate: { greater_than_equal: historicalDateStr } },
          { valueDate: { less_than: meeting.holdingsLimit } },
          { fund: { in: companyFunds } },
          { 'holdings.stock': { equals: stockId } },
        ],
      },
      sort: '-valueDate',
    })
    mt?.end('query.holdings.historical')
    if (res.docs && res.docs.length) results.push(res.docs[0])
  }

  return results
}

async function processMeeting(
  meeting: Meeting,
  req: PayloadRequest,
  funds: string[],
  isPartialUpdate = false,
  runAgg?: PerfTimer,
  holdingDocsCache: Map<string, any> = new Map(),
): Promise<void> {
  // prefer shared timer if passed from caller; otherwise create local one
  const mt = runAgg ?? initPerformanceContext(req).mt
  mt.start('meetingTotal')
  let isDirty = false
  req.payload.logger.info(
    {
      timestamp: new Date().toISOString(),
      meetingId: meeting.id,
      fundsCount: funds.length,
      isPartialUpdate,
    },
    `Processing meeting ${meeting.id}`,
  )
  // Get holdings for each company
  mt.start('holdingsLookupTotal')
  // Precompute identifiers to avoid repeated conversions
  const stockDocId = String(getIdOfRelationField(meeting.stock))
  const holdingsLimit = meeting.holdingsLimit

  // Optional simple concurrency cap via env (default 48)
  const CONCURRENCY = Math.max(1, Number(process.env.HOLDINGS_CONCURRENCY || 48))
  const results: any[] = []

  for (let i = 0; i < funds.length; i += CONCURRENCY) {
    const slice = funds.slice(i, i + CONCURRENCY)
    const batch = await Promise.all(
      slice.map(async (fund) => {
        // Create a cache key using fund and meeting.holdingsLimit
        const cacheKey = `${fund}_${holdingsLimit}`

        // Check if the holdingDoc exists in cache
        let holdingDoc = null as any
        if (holdingDocsCache.has(cacheKey)) {
          holdingDoc = holdingDocsCache.get(cacheKey)
        } else {
          // Get the holdings matching the less than equal holdings date
          mt.start('query.holdings.find')
          const { docs: holdingsDocs } = await req.payload.find({
            collection: 'holdings',
            depth: 0,
            pagination: false,
            select: {
              valueDate: true,
              holdings: true,
            },
            where: {
              and: [{ valueDate: { less_than_equal: holdingsLimit } }, { fund: { equals: fund } }],
            },
            sort: '-valueDate',
            limit: 1,
          })
          mt.end('query.holdings.find')
          holdingDoc = holdingsDocs.length > 0 ? holdingsDocs[0] : null

          // Store in cache for future use
          holdingDocsCache.set(cacheKey, holdingDoc)
        }

        const nearestHoldingsLimitDate = holdingDoc?.valueDate
        if (!nearestHoldingsLimitDate) {
          return null // No holdings found
        }

        // Find first matching holding without creating intermediate arrays
        let matched: any | null = null
        const arr = holdingDoc.holdings as any[]
        for (let k = 0; k < arr.length; k++) {
          const h = arr[k]
          if (h && h.stock == stockDocId) {
            matched = h
            break
          }
        }
        if (!matched) return null

        return {
          fund,
          holdings: [matched],
          // expose the valueDate of the holding document used for this fund so we can
          // persist it on the meeting.fundsWithHolding.holdingDate for migrations
          holdingDate: nearestHoldingsLimitDate,
        }
      }),
    )
    for (const item of batch) if (item) results.push(item)
  }
  const holdings = results
  mt.end('holdingsLookupTotal')

  // holdings already flattened by construction
  const flattenedHoldings = holdings

  if (flattenedHoldings.length === 0) {
    req.payload.logger.error(
      {
        meetingId: meeting.id,
        stock: meeting.stock,
        holdingsLimit: meeting.holdingsLimit,
        totalFunds: funds.length,
      },
      `No holdings found for ANY fund in meeting ${meeting.id} — skipping update`,
    )
    return
  }

  // Check and update funds list
  const newFundsSet = new Set<string>()

  for (let i = 0; i < flattenedHoldings.length; i++) {
    const holding = flattenedHoldings[i]
    const fundId: string = holding.fund
    if (!newFundsSet.has(fundId)) {
      newFundsSet.add(fundId)
      isDirty = true
    }
  }

  const newFunds = Array.from(newFundsSet)

  // Update meeting if necessary
  if (isDirty || !meeting.fundsWithHolding?.length) {
    req.payload.logger.info(
      `Successfully processed companies-meeting: ${meeting.id} with companies: ${newFunds.join(', ')}`,
    )

    const prevFwh = Array.isArray(meeting.fundsWithHolding) ? meeting.fundsWithHolding : []
    const prevByFund = new Map(prevFwh.map((p: any) => [String(p.fund), p]))
    let fromRelatedStock = false

    const newFundsWithHolding = flattenedHoldings.map((h) => {
      const rawOriginal = h.holdings[0]?.originalData
      const originalDataArray = rawOriginal
        ? Array.isArray(rawOriginal)
          ? rawOriginal
          : [rawOriginal]
        : []

      const fundId = String(getIdOfRelationField(h.fund))
      fromRelatedStock = originalDataArray.some((o) => o.stockId != meeting.stockId)
      const base = {
        company: getCompanyIdFromFundId(fundId),
        fund: fundId,
        quantity: h.holdings[0]?.quantity ?? 0,
        // Persist the exact holding date used for this fund (valueDate of the selected holding doc)
        holdingDate: h?.holdingDate || null,
        fromRelatedStock,
        original: originalDataArray.filter(Boolean).map((item: any) => ({
          stockId: item.stockId,
          accountNum: item.accountNum,
          quantity: item.quantity,
        })),
      }
      const prev = prevByFund.get(fundId) || {}
      return { ...prev, ...base }
    })

    // If this is a partial update, merge with existing fundsWithHolding
    let fundsWithHolding = newFundsWithHolding
    if (isPartialUpdate) {
      const updatedFundIds = new Set(newFundsWithHolding.map((f: any) => String(f.fund)))
      // Keep existing fundsWithHolding that were not in the update
      const existingFundsToKeep = prevFwh.filter(
        (f: NonNullable<FundWithHolding>[number]) => !updatedFundIds.has(String(f.fund)),
      )
      fundsWithHolding = [...existingFundsToKeep, ...newFundsWithHolding]
      req.payload.logger.info(
        `Partial update: kept ${existingFundsToKeep.length} existing funds, updated ${newFundsWithHolding.length} funds`,
      )
    }
    // Get all unique fund IDs from fundsWithHolding (both new and existing)
    const allFundIdsInMeeting = Array.from(
      new Set(fundsWithHolding.map((f: any) => String(f.fund))),
    )

    // Use cache mapping instead of querying companies to resolve parentCompany per fund
    mt.start('query.companies.find')
    const fundToCompanyMap = getFundToCompanyMap() || {}
    const compIds = allFundIdsInMeeting
      .map((fundId) => fundToCompanyMap[String(fundId)])
      .filter(Boolean)
    mt.end('query.companies.find')

    // Filter out removed companies
    // removedCompanies is an array of company IDs (strings) or company objects
    const removedCompanyIds = (meeting.removedCompanies || []).map(getIdOfRelationField)

    const filteredCompIds = compIds.filter((compId) => {
      if (!compId) return false
      return !removedCompanyIds.includes(compId)
    })

    // Filter out funds that belong to removed companies (from all funds in meeting)
    const filteredFunds = allFundIdsInMeeting.filter((fundId) => {
      const companyId = getCompanyIdFromFundId(fundId)
      return companyId && !removedCompanyIds.includes(companyId)
    })

    // Filter out fundsWithHolding that belong to removed companies
    const filteredFundsWithHolding = fundsWithHolding.filter((fwh: any) => {
      const companyId = getIdOfRelationField(fwh.company)
      if (!companyId) return false
      const companyIdStr = String(companyId)
      return !removedCompanyIds.includes(companyIdStr)
    })

    filteredFunds.sort((a, b) => String(a).localeCompare(String(b)))

    // Calculate historical holdings (30 days before holdingsLimit)
    const historicalHoldings: NonNullable<HistoricalHolding> = []
    const historicalEnabled = true
    if (historicalEnabled && meeting.holdingsLimit) {
      const historicalDate = new Date(meeting.holdingsLimit)
      historicalDate.setDate(historicalDate.getDate() - 30)
      // Get all companies that are currently invited (to exclude them)
      const invitedCompanyIds = new Set(
        filteredCompIds
          .map((id) => getIdOfRelationField(id || ''))
          .filter((id): id is string => typeof id === 'string' || typeof id === 'object'),
      )

      // Track which company+fund combinations we've already found holdings for
      const processedCombinations = new Set<string>()

      // Build the list of companies to check for historical (non-invited, not removed)
      // Use ALL companyIds from the cache mapping values, not only those tied to current fundsWithHolding
      const f2cMap = getFundToCompanyMap() || {}
      const allCompanyIdsFromCache = Array.from(new Set(Object.values(f2cMap).map(String)))
      const companiesToCheck = allCompanyIdsFromCache.filter(
        (cid) => !invitedCompanyIds.has(cid) && !removedCompanyIds.includes(cid),
      )

      // Query only holdings that contain the specific stock (extracted API)
      mt.start('historical.query')
      const allHistoricalHoldings = await fetchHistoricalHoldings(
        req,
        meeting,
        companiesToCheck,
        mt,
      )
      mt.end('historical.query')

      // Process holdings from newest to oldest
      mt.start('historical.process.js')
      for (const holdingDoc of allHistoricalHoldings) {
        const fundId = getIdOfRelationField(holdingDoc.fund) as string
        const companyId = getCompanyIdFromFundId(fundId)

        // Skip if company is invited or removed
        if (
          !companyId ||
          invitedCompanyIds.has(companyId) ||
          removedCompanyIds.includes(companyId)
        ) {
          continue
        }

        // Create a unique key for this company+fund combination
        const combinationKey = `${companyId}|${fundId}`

        // Skip if we've already processed this company+fund combination
        if (processedCombinations.has(combinationKey)) {
          continue
        }

        // Find the matching holding (we know it exists because of the query filter)
        const matchedHolding = holdingDoc.holdings.find((holding: HoldingsPerDay[number]) => {
          return holding.stock == stockDocId
        })

        if (matchedHolding) {
          historicalHoldings.push({
            company: companyId,
            fund: fundId,
            lastHoldingDate: holdingDoc.valueDate,
            quantity: matchedHolding.quantity ?? 0,
          })

          processedCombinations.add(combinationKey)
          // track unique count
          mt.inc('historical.unique.count', 1)
        }

        // Optional early stop: if we've covered all possible pairs, break
        // We approximate the target by number of non-invited and not-removed companies times 1 (per fund we only need first occurrence)
        // Since funds can map to the same company, we simply allow full iteration; guard left for future refinement.
      }
      mt.end('historical.process.js')

      req.payload.logger.info(
        `Found ${historicalHoldings.length} historical holdings for meeting ${meeting.id}`,
      )
    }

    // Prepare change details
    const changeDate = new Date().toISOString()
    const changeSource = req.context?.from || 'process'

    // Create a detailed description of what was changed
    const companiesCount = Array.from(new Set(filteredCompIds)).length
    const fundsCount = filteredFunds.length
    const changeDescription = `עדכון חברות ותיקים: ${companiesCount} חברות, ${fundsCount} תיקים`
    const hasRelatedStocks = fromRelatedStock

    const migrationComments = `${changeDate} - [${changeSource}] ${changeDescription}`
    const data: Partial<Meeting> = {
      companies: Array.from(new Set(filteredCompIds)) as string[],
      funds: [...filteredFunds],
      fundsWithHolding: filteredFundsWithHolding,
      historicalHoldings,
      migrationComments,
      hasRelatedStocks,
    }

    // Skip-update guard: compute a deterministic hash of the payload and compare with stored value
    try {
      const stable = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj
        if (Array.isArray(obj)) return obj.map(stable)
        return Object.keys(obj)
          .sort()
          .reduce((acc: any, k) => {
            acc[k] = stable(obj[k])
            return acc
          }, {})
      }
      const payloadForHash = stable({
        companies: data.companies,
        funds: data.funds,
        fundsWithHolding: data.fundsWithHolding,
        historicalHoldings: data.historicalHoldings,
      })
      const json = JSON.stringify(payloadForHash)
      // lightweight hash (FNV-1a 32-bit)
      let h = 0x811c9dc5
      for (let i = 0; i < json.length; i++) {
        h ^= json.charCodeAt(i)
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
      }
      const processHash = `fnv1a32:${h.toString(16)}`
      if ((meeting as any).processHash === processHash) {
        req.payload.logger.info(
          { meetingId: meeting.id },
          'Skip update: no changes detected (processHash match)',
        )
        mt.inc('update.skipped', 1)
        // still run cleanup to ensure votes stay consistent with current companies
        await cleanupInvalidVotesForMeetings(req, [String(meeting.id)], mt)
        mt.end('meetingTotal')
        return
      }
      ;(data as any).processHash = processHash
    } catch {}
    mt.start('mutation.meetings.update')
    await req.payload.update({
      collection: 'meetings',
      id: meeting.id,
      req: {
        ...req,
        context: { ...req.context, from: 'process', process: 'processCompaniesMeetings' },
      },
      data,
    })
    mt.end('mutation.meetings.update')
    // Use the new cleanup API to remove invalid votes for this meeting
    await cleanupInvalidVotesForMeetings(req, [String(meeting.id)], mt)
  }
  mt.end('meetingTotal')
}

/**
 * Process companies and meetings to populate the companies-meetings collection
 * This function:
 * 1. Gets all leaf companies (companies with accounts)
 * 2. For each meeting, checks if a company has holdings for the meeting's stock on the holdingLimit date
 * 3. If a match is found, adds an entry to the companies-meetings collection
 *
 * @param req PayloadRequest object
 * @param meetingIds Optional array of meeting IDs to process. If not provided, all meetings will be processed.
 * @param fundsToProcess Optional array of fund IDs to process. If not provided, all active funds will be queried.
 */
export const processCompaniesMeetings = async (
  req: PayloadRequest,
  meetingIds?: string[],
  fundsToProcess?: string[],
): Promise<void> => {
  try {
    const { perfEnabled, perfVerbose, slowThresholdMs, mt } = initPerformanceContext(req)
    mt.start('total')
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        meetingIds: meetingIds?.length || 'all',
        fundsProvided: fundsToProcess ? fundsToProcess.length : 'none',
      },
      'Starting processCompaniesMeetings',
    )

    // Initialize the map of fundId -> companyId
    req.payload.logger.info('Starting to load funds')
    // Get all meetings or specific meetings if meetingIds is provided
    req.payload.logger.info('Starting to load meetings')
    mt.start('query.meetings.buildWhere')
    const where = meetingIds
      ? { id: { in: meetingIds } }
      : ({
          and: [
            { holdingsLimit: { greater_than: new Date().toISOString() } },
            { finalized: { not_equals: true } },
            { state: { not_equals: 'completed' } },
          ],
        } as Where)
    mt.end('query.meetings.buildWhere')
    mt.start('query.meetings.find')
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      limit: 0,
      where,
      depth: 0,
      sort: '-holdingsLimit',
    })
    mt.end('query.meetings.find')
    req.payload.logger.info('loaded meetings:' + meetings.length)

    // Use provided funds or, else, preload via cache helper and use as-is per instruction
    let funds: string[] = []
    if (fundsToProcess && fundsToProcess.length > 0) {
      funds = fundsToProcess
      req.payload.logger.info(`Using provided funds: ${funds.length} funds`)
    } else {
      funds = (getActiveFundsCache() as string[] | undefined) || []
      req.payload.logger.info(
        `Preloaded active funds via helper: ${Array.isArray(funds) ? funds.length : 0} funds`,
      )
    }

    // Shared cache of holding documents for reuse across all meetings in this run
    const holdingDocsCache = new Map<string, any>()

    // Process meetings in batches to avoid MongoDB session issues
    const batchSize = 10 // Process 10 meetings at a time
    // Process meetings in batches
    mt.start('batches.total')
    for (let i = 0; i < meetings.length; i += batchSize) {
      const batchPromises: Promise<void>[] = []
      const batchEnd = Math.min(i + batchSize, meetings.length)

      req.payload.logger.info(
        `Processing batch ${i / batchSize + 1} (meetings ${i + 1}-${batchEnd} of ${meetings.length})`,
      )

      // Create promises for this batch
      mt.start(`batch#${i / batchSize + 1}`)
      for (let j = i; j < batchEnd; j++) {
        const meeting = meetings[j]
        // Skip if meeting doesn't have a stock or holdingsLimit
        if (!meeting.stock || !meeting.holdingsLimit) {
          continue
        }
        console.log('meeting started', meeting.id)
        // If funds were provided, this is a partial update
        const isPartialUpdate = fundsToProcess && fundsToProcess.length > 0
        const promise = processMeeting(meeting, req, funds, isPartialUpdate, mt, holdingDocsCache)
          .then(() => {
            console.log('meeting finished', meeting.id)
          })
          .catch((error) => {
            req.payload.logger.error(
              { error },
              `Error processing meeting ${meeting.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
            // Don't rethrow the error to allow other meetings to be processed
          })
        batchPromises.push(promise)
      }

      // Wait for this batch to complete before moving to the next
      await Promise.all(batchPromises)
      mt.end(`batch#${i / batchSize + 1}`)
      req.payload.logger.info(`Completed batch ${i / batchSize + 1}`)
    }
    mt.end('batches.total')

    mt.end('total')
    const summary = mt.summary()
    const duration = (summary.totalMs / 1000).toFixed(2)
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        meetingsProcessed: meetings.length,
        fundsUsed: funds.length,
        perf: summary,
      },
      'End of process: All meetings have been processed',
    )
  } catch (error: unknown) {
    req.payload.logger.error(
      { error },
      `Error processing companies-meetings: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
    throw error
  }
}

/**
 * Cleanup helper: delete votes that belong to companies not listed on the meeting
 * This is extracted from processMeeting (lines 177-201) and adapted to work independently
 * of the holdings enrichment. It uses the meeting's current `companies` field as the
 * source of truth for valid companies.
 */
export const cleanupInvalidVotesForMeetings = async (
  req: PayloadRequest,
  meetingIds: string[],
  runAgg?: PerfTimer,
): Promise<void> => {
  const total = meetingIds.length
  for (let idx = 0; idx < meetingIds.length; idx++) {
    const meetingId = meetingIds[idx]
    try {
      // Load meeting companies only
      const meeting = await req.payload.findByID({
        collection: 'meetings',
        id: meetingId,
        select: { companies: true },
        depth: 0,
      })
      runAgg?.inc('findCalls', 1)
      runAgg?.inc('docsRead', 1)

      const companies: string[] = Array.isArray((meeting as any).companies)
        ? ((meeting as any).companies as string[])
        : []

      const validCompanyIds = companies.filter(Boolean).map(String)

      // Single bulk delete: remove votes for this meeting whose company is not in the valid list
      // If the valid list is empty, this will delete all votes for the meeting (expected behavior)
      await req.payload.delete({
        collection: 'votes',
        where: {
          and: [
            { meeting: { equals: meetingId } },
            { company: { not_in: validCompanyIds.length > 0 ? validCompanyIds : ['__NONE__'] } },
          ],
        },
        req,
      } as any)
      runAgg?.inc('deleteCalls', 1)
      req.payload.logger.info(
        `meeting ${meetingId}: cleanup completed (${idx + 1} of ${total}) - removed votes for companies not in [${validCompanyIds.join(
          ', ',
        )}]`,
      )
    } catch (error) {
      req.payload.logger.error(
        { error },
        `Error during cleanupInvalidVotesForMeetings for meeting ${meetingId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
      // Continue with next meeting
    }
  }
}
