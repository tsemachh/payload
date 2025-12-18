import { PayloadRequest, Where } from 'payload'
import type {
  FundWithHolding,
  HistoricalHolding,
  HoldingsPerDay,
  Meeting,
  StockValue,
} from '@/payload-types'
import {
  getCompanyIdFromFundId,
  getIdOfRelationField,
  initFundIdToCompanyIdMap,
} from '@/utils/utils'

async function processMeeting(
  meeting: Meeting,
  req: PayloadRequest,
  funds: string[],
  isPartialUpdate = false,
): Promise<void> {
  let isDirty = false
  // Structured log instead of console.log
  req.payload.logger.info(
    {
      timestamp: new Date().toISOString(),
      meetingId: meeting.id,
      fundsCount: funds.length,
      isPartialUpdate,
    },
    `Processing meeting ${meeting.id}`,
  )
  // Cache for holding documents to avoid redundant API calls
  const holdingDocsCache = new Map<string, any>()

  // Pre-filter funds by removed companies to avoid unnecessary lookups for this meeting
  const removedCompanyIds = (meeting.removedCompanies || [])
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter((id): id is string => typeof id === 'string')

  const filteredFundsForMeeting = funds.filter((fundId) => {
    const companyId = getCompanyIdFromFundId(fundId)
    return companyId && !removedCompanyIds.includes(companyId)
  })

  // Helper: chunk an array to process in batches
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  // Batch fetch: for this meeting, get the latest holdings doc per fund (that contains the stock),
  // using a single query per chunk instead of one query per fund.
  const stockId = String(getIdOfRelationField(meeting.stock) || '')
  const latestByFund = new Map<string, any>()

  for (const group of chunk(filteredFundsForMeeting, 200)) {
    // Check cache first for the whole chunk; we still might have partial cache hits
    const toQuery: string[] = []
    for (const fund of group) {
      const cacheKey = `${fund}_${meeting.holdingsLimit}`
      if (holdingDocsCache.has(cacheKey)) {
        const cached = holdingDocsCache.get(cacheKey)
        if (cached) {
          latestByFund.set(String(getIdOfRelationField(cached.fund)), cached)
        }
      } else {
        toQuery.push(fund)
      }
    }

    if (toQuery.length === 0) continue

    const { docs } = await req.payload.find({
      collection: 'holdings',
      depth: 0,
      where: {
        and: [
          { valueDate: { less_than_equal: meeting.holdingsLimit } },
          { fund: { in: toQuery } },
          { 'holdings.stock': { equals: stockId } },
        ],
      },
      // Sort by newest first globally; first encounter per fund is the latest for that fund
      sort: '-valueDate',
      limit: 0,
      select: {
        fund: true,
        valueDate: true,
        holdings: true,
      },
    })

    for (const doc of docs) {
      const fundId = String(getIdOfRelationField(doc.fund))
      if (!latestByFund.has(fundId)) {
        latestByFund.set(fundId, doc)
        // Store in cache for future use
        const cacheKey = `${fundId}_${meeting.holdingsLimit}`
        holdingDocsCache.set(cacheKey, doc)
      }
      if (latestByFund.size === group.length) break
    }
  }

  // Transform to the same structure the old loop returned
  const holdings = Array.from(latestByFund.values()).map((holdingDoc) => {
    const matchedHoldings = holdingDoc.holdings.filter((holding: any) => {
      return holding.stock == stockId
    })
    if (matchedHoldings.length === 0) return []
    return {
      fund: getIdOfRelationField(holdingDoc.fund) as string,
      holdings: matchedHoldings,
    }
  })

  const flattenedHoldings = holdings.flat()

  if (flattenedHoldings.length === 0) {
    const stockDetails = await req.payload.findByID({
      collection: 'stocks',
      id: getIdOfRelationField(meeting.stock) || '',
      depth: 0,
    })
    req.payload.logger.error(
      {
        meetingId: meeting.id,
        stock: {
          id: stockDetails.id,
          name: stockDetails.name,
          isTracking: stockDetails.tradable,
        },
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
    const meetingStockId = String(getIdOfRelationField(meeting.stock))

    const newFundsWithHolding = flattenedHoldings.map((h) => {
      const rawOriginal = h.holdings[0]?.originalData
      const originalDataArray = rawOriginal
        ? Array.isArray(rawOriginal)
          ? rawOriginal
          : [rawOriginal]
        : []

      const fundId = String(getIdOfRelationField(h.fund))
      fromRelatedStock = originalDataArray.some((o) => String(o.stockId) !== meetingStockId)
      const base = {
        company: getCompanyIdFromFundId(fundId),
        fund: fundId,
        quantity: h.holdings[0]?.quantity ?? 0,
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
    let stockValue: string | StockValue | null = meeting.stockValue as string
    if (!stockValue) {
      const { docs: stockValueDocs } = await req.payload.find({
        collection: 'stock-values',
        depth: 0,
        where: {
          and: [
            { stockId: { equals: getIdOfRelationField(meeting.stock) } },
            { valueDate: { less_than_equal: meeting.holdingsLimit } },
          ],
        },
        limit: 1,
        sort: '-valueDate',
      })
      stockValue = stockValueDocs.length > 0 ? stockValueDocs[0].id : null
    }
    // Get all unique fund IDs from fundsWithHolding (both new and existing)
    const allFundIdsInMeeting = Array.from(
      new Set(fundsWithHolding.map((f: any) => String(f.fund))),
    )

    // Build compIds using the initialized fund->company map to avoid a per-meeting DB query
    const parentCompanyIds = allFundIdsInMeeting
      .map((fundId) => getCompanyIdFromFundId(String(fundId)))
      .filter(Boolean)

    const filteredCompIds = parentCompanyIds.filter((compId) => {
      return compId && !removedCompanyIds.includes(compId)
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
    if (meeting.holdingsLimit) {
      const historicalDate = new Date(meeting.holdingsLimit)
      historicalDate.setDate(historicalDate.getDate() - 30)
      const historicalDateStr = historicalDate.toISOString()

      // Get all companies that are currently invited (to exclude them)
      const invitedCompanyIds = new Set(
        filteredCompIds
          .map((id) => getIdOfRelationField(id || ''))
          .filter((id): id is string => typeof id === 'string' || typeof id === 'object'),
      )

      // Query only funds that belong to companies that are NOT already invited and not removed
      const uninvitedFunds = funds.filter((fundId) => {
        const companyId = getCompanyIdFromFundId(fundId)
        return (
          companyId && !invitedCompanyIds.has(companyId) && !removedCompanyIds.includes(companyId)
        )
      })

      // Track which company+fund combinations we've already found holdings for
      const processedCombinations = new Set<string>()

      // Query only holdings that contain the specific stock
      const { docs: allHistoricalHoldings } = await req.payload.find({
        collection: 'holdings',
        depth: 0,
        pagination: false as any,
        where: {
          and: [
            { valueDate: { greater_than_equal: historicalDateStr } },
            { valueDate: { less_than: meeting.holdingsLimit } },
            { fund: { in: uninvitedFunds } },
            { 'holdings.stock': { equals: getIdOfRelationField(meeting.stock) } },
          ],
        },
        sort: '-valueDate',
        limit: 0,
        select: { fund: true, valueDate: true, holdings: true },
      })

      // Process holdings from newest to oldest
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
          return holding.stock == getIdOfRelationField(meeting.stock)
        })

        if (matchedHolding) {
          historicalHoldings.push({
            company: companyId,
            fund: fundId,
            lastHoldingDate: holdingDoc.valueDate,
            quantity: matchedHolding.quantity ?? 0,
          })

          processedCombinations.add(combinationKey)
        }
      }

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

    if (stockValue) data.stockValue = stockValue
    await req.payload.update({
      collection: 'meetings',
      id: meeting.id,
      req: {
        ...req,
        context: { ...req.context, from: 'process' },
      },
      data,
    })
    // Use the new cleanup API to remove invalid votes for this meeting
    await cleanupInvalidVotesForMeetings(req, [String(meeting.id)])
  }
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
    const startTime = Date.now()
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        meetingIds: meetingIds?.length || 'all',
        fundsProvided: fundsToProcess ? fundsToProcess.length : 'none',
      },
      'Starting processCompaniesMeetings',
    )

    // Initialize the map of fundId -> companyId
    req.payload.logger.info('Initializing fundId -> companyId map')
    await initFundIdToCompanyIdMap(req.payload)
    req.payload.logger.info('Map initialized successfully')

    req.payload.logger.info('Starting to load funds')
    // Get all meetings or specific meetings if meetingIds is provided
    req.payload.logger.info('Starting to load meetings')
    const where = meetingIds
      ? { id: { in: meetingIds } }
      : ({
          and: [
            { holdingsLimit: { greater_than: new Date().toISOString() } },
            { finalized: { not_equals: true } },
            { state: { not_equals: 'completed' } },
          ],
        } as Where)
    const { docs: meetings } = await req.payload.find({
      collection: 'meetings',
      limit: 0,
      where,
      depth: 0,
      select: {
        id: true,
        stock: true,
        holdingsLimit: true,
        fundsWithHolding: true,
        removedCompanies: true,
        stockValue: true,
        finalized: true,
        state: true,
      },
      sort: '-holdingsLimit',
    })
    req.payload.logger.info('loaded meetings:' + meetings.length)

    // Use provided funds or query all active funds
    let funds: string[]
    if (fundsToProcess && fundsToProcess.length > 0) {
      funds = fundsToProcess
      req.payload.logger.info(`Using provided funds: ${funds.length} funds`)
    } else {
      const { docs } = await req.payload.find({
        collection: 'companies',
        depth: 0,
        limit: 0,
        where: {
          type: { equals: 'fund' },
          active: { equals: true },
        },
        select: { name: true },
      })
      funds = docs.length > 0 ? (docs.map(getIdOfRelationField) as string[]) : []
      req.payload.logger.info(`Queried all active funds: ${funds.length} funds`)
    }

    // Process meetings in batches to avoid MongoDB session issues
    const batchSize = 10 // Process 10 meetings at a time
    // Process meetings in batches
    for (let i = 0; i < meetings.length; i += batchSize) {
      const batchPromises: Promise<void>[] = []
      const batchEnd = Math.min(i + batchSize, meetings.length)

      req.payload.logger.info(
        `Processing batch ${i / batchSize + 1} (meetings ${i + 1}-${batchEnd} of ${meetings.length})`,
      )

      // Create promises for this batch
      for (let j = i; j < batchEnd; j++) {
        const meeting = meetings[j]
        // Skip if meeting doesn't have a stock or holdingsLimit
        if (!meeting.stock || !meeting.holdingsLimit) {
          continue
        }
        req.payload.logger.info({ meetingId: meeting.id }, 'meeting started')
        // If funds were provided, this is a partial update
        const isPartialUpdate = fundsToProcess && fundsToProcess.length > 0
        const promise = processMeeting(meeting, req, funds, isPartialUpdate)
          .then(() => {
            req.payload.logger.info({ meetingId: meeting.id }, 'meeting finished')
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
      req.payload.logger.info(`Completed batch ${i / batchSize + 1}`)
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    req.payload.logger.info(
      {
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        meetingsProcessed: meetings.length,
        fundsUsed: funds.length,
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
