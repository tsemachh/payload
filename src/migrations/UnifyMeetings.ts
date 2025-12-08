import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { logMigrationFault } from '@/migrations/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { Meeting, Vote } from '@/payload-types'
import { getIdOfRelationField } from '@/utils/utils'

/**
 * Migration to unify duplicate meetings in the system
 *
 * Duplication happens because of 2 reasons:
 * 1. The need to provide different recommendations for the agenda items
 * 2. Dual stocks (stocks that exist in both Israeli and foreign stock exchanges)
 *
 * This migration:
 * - Finds all meetings in the system
 * - Groups them by a composite key: magnaId + "-" + meeting date + "-" + stockId + "-" + invitationLink
 * - Keeps one meeting per group and purges the duplicates
 * - Moves votes from duplicate meetings to the kept meeting
 * - Handles different recommendations per company in the agenda items
 */
// Helper function to introduce a small delay to allow garbage collection
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to generate a composite key for a meeting
function generateMeetingKey(meeting: Meeting): string {
  const magnaId = meeting.magnaId || 'null'
  const meetingDate = meeting.meetingDate || 'null'
  const stockId = meeting.stock || 'null'
  const invitationLink = meeting.invitationLink || 'null'

  return `${magnaId}-${meetingDate}-${stockId}-${invitationLink}`
}

// Process a group of meetings with the same composite key
async function processMeetingGroup(
  payload: any,
  req: any,
  meetings: Meeting[],
  groupKey: string,
): Promise<boolean> {
  try {
    console.log(`Processing group: ${groupKey} with ${meetings.length} meetings`)

    // If there's only one meeting in the group, no need to merge
    if (meetings.length <= 1) {
      console.log(`Only one meeting for key ${groupKey}, no unification needed`)
      return true
    }

    // Sort meetings by creation date (oldest first) to keep the original one
    const sortedMeetings = [...meetings].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateA - dateB
    })

    // Keep the first meeting and merge data from others
    const meetingToKeep = sortedMeetings[0]
    const meetingsToRemove = sortedMeetings.slice(1)

    const displayId = (m: any) => (m?.primaryLegacyId ? m.primaryLegacyId : m?.id)
    console.log(
      `Keeping meeting ${displayId(meetingToKeep)}, removing ${meetingsToRemove.length} duplicates for key ${groupKey}`,
    )

    // Detailed log of which meetings are unified into which meeting
    try {
      const removedIds = meetingsToRemove
        .map((m) => displayId(m))
        .filter(Boolean)
        .join(',')
      if (removedIds) {
        console.log(`meetings - ${removedIds} were unified to meeting ${displayId(meetingToKeep)}`)
      }
    } catch (e) {
      // no-op: logging failure should not affect migration flow
    }

    // Initialize accumulators for a single final update
    const companiesSet = new Set<string>((meetingToKeep.companies as any) || [])
    const agendaMapGlobal: Map<number, any> | null = meetingToKeep.agenda
      ? new Map(meetingToKeep.agenda.map((item: any, idx: number) => [idx, { ...item }]))
      : null
    // Accumulators for funds and fundsWithHolding to move from removed meetings
    const fundsSet = new Set<string>(((meetingToKeep.funds as any) || []).map(getIdOfRelationField))
    const fundsWithHoldingAcc: any[] = [
      ...(((meetingToKeep as any).fundsWithHolding as any[]) || []),
    ]
    // Accumulator for legacyIds to append primaryLegacyId of removed meetings
    const legacyIdSet = new Set<string>(((meetingToKeep as any).legacyIds || []).filter(Boolean))
    // Track finalized across unified meetings: only true if ALL source meetings are finalized=true
    let allFinalized = !!(meetingToKeep as any)?.finalized
    const removedMeetingIds: string[] = []
    let totalVotesMoved = 0
    let agendaChangesCount = 0
    let fundsAddedFromRemoved = 0
    let fundsWithHoldingAddedFromRemoved = 0
    let legacyIdsAddedFromRemoved = 0
    const summaryLines: string[] = []

    // Collect all votes from meetings to be removed
    for (const meetingToRemove of meetingsToRemove) {
      // Find votes for this meeting
      const votesResult = await payload.find({
        collection: 'votes',
        where: {
          meeting: {
            equals: meetingToRemove.id,
          },
        },
        limit: 0,
        depth: 0,
      })

      const votes = votesResult.docs as Vote[]
      console.log(`Found ${votes.length} votes for meeting ${displayId(meetingToRemove)}`)

      // Merge companies from the removed meeting into an accumulator (single update later)
      const incomingCompanies = meetingToRemove.companies || []
      if (incomingCompanies.length > 0) {
        incomingCompanies.forEach((c: any) => companiesSet.add(c as any))
      }

      // Update finalized aggregator
      allFinalized = allFinalized && !!(meetingToRemove as any)?.finalized

      // Merge funds from the removed meeting (ids) into accumulator
      const incomingFunds = (meetingToRemove.funds as any[]) || []
      if (incomingFunds.length > 0) {
        const before = fundsSet.size
        incomingFunds.map(getIdOfRelationField).forEach((f: any) => fundsSet.add(f as any))
        fundsAddedFromRemoved += fundsSet.size - before
      }

      // Merge fundsWithHolding rows from the removed meeting into accumulator (no complex dedupe)
      const incomingFundsWithHolding = ((meetingToRemove as any).fundsWithHolding as any[]) || []
      if (incomingFundsWithHolding.length > 0) {
        fundsWithHoldingAcc.push(...incomingFundsWithHolding)
        fundsWithHoldingAddedFromRemoved += incomingFundsWithHolding.length
      }

      // Move votes to the kept meeting
      await payload.update({
        collection: 'votes',
        data: {
          meeting: meetingToKeep.id,
        },
        where: {
          id: { in: votes.map(getIdOfRelationField) },
        },
        req: {
          ...req,
          context: { ...req.context, from: 'migration', process: 'unifyMeetings' },
        },
      })
      totalVotesMoved += votes.length

      // Append the primaryLegacyId of the removed meeting into the kept meeting's legacyIds
      const primaryLegacyIdToAppend = (meetingToRemove as any)?.primaryLegacyId
      if (primaryLegacyIdToAppend) {
        const before = legacyIdSet.size
        legacyIdSet.add(String(primaryLegacyIdToAppend))
        legacyIdsAddedFromRemoved += legacyIdSet.size - before
      }

      // Merge agenda items comparing base recommendations; defer DB update until end
      if (agendaMapGlobal && meetingToRemove.agenda) {
        // Process agenda items from the meeting to remove
        meetingToRemove.agenda.forEach((item, index) => {
          if (agendaMapGlobal && index < agendaMapGlobal.size) {
            const keptItem = agendaMapGlobal.get(index)

            const keptBaseRec = keptItem?.recommendation?.votingRecommendation
            const srcBaseRec = item?.recommendation?.votingRecommendation

            // If base recommendations differ → create/align exceptional on kept item and merge meeting-level companies
            if (srcBaseRec && keptBaseRec && srcBaseRec !== keptBaseRec) {
              agendaChangesCount++
              if (!keptItem.exceptionalRecommendation?.showExceptional) {
                keptItem.exceptionalRecommendation = {
                  showExceptional: true,
                  companies: [],
                  votingRecommendation: srcBaseRec,
                  reasonRef: item?.exceptionalRecommendation?.reasonRef,
                  reasonText: item?.exceptionalRecommendation?.reasonText,
                }
              } else {
                keptItem.exceptionalRecommendation.votingRecommendation = srcBaseRec
                keptItem.exceptionalRecommendation.reasonRef =
                  item?.exceptionalRecommendation?.reasonRef ||
                  keptItem.exceptionalRecommendation.reasonRef
                keptItem.exceptionalRecommendation.reasonText =
                  item?.exceptionalRecommendation?.reasonText ||
                  keptItem.exceptionalRecommendation.reasonText
              }

              if (meetingToRemove.companies && meetingToRemove.companies.length > 0) {
                keptItem.exceptionalRecommendation.companies = Array.from(
                  new Set([
                    ...(keptItem.exceptionalRecommendation.companies || []),
                    ...meetingToRemove.companies,
                  ]),
                )
              }
            } else if (
              item.exceptionalRecommendation?.showExceptional &&
              item.exceptionalRecommendation.companies &&
              item.exceptionalRecommendation.companies?.length > 0
            ) {
              // Recommendations equal; merge exceptional companies from source item
              keptItem.exceptionalRecommendation = keptItem.exceptionalRecommendation
                ?.showExceptional
                ? keptItem.exceptionalRecommendation
                : { showExceptional: true, companies: [] }

              keptItem.exceptionalRecommendation.companies = Array.from(
                new Set([
                  ...(keptItem.exceptionalRecommendation.companies || []),
                  ...(item.exceptionalRecommendation.companies || []),
                ]),
              )
            }

            agendaMapGlobal.set(index, keptItem)
          }
        })
      }

      // Delete the duplicate meeting
      await payload.delete({
        collection: 'meetings',
        id: meetingToRemove.id,
        req: {
          ...req,
          context: { ...req.context, from: 'migration', process: 'unifyMeetings' },
        },
      })

      removedMeetingIds.push(String(displayId(meetingToRemove)))
      summaryLines.push(
        `- Removed meeting ${String(displayId(meetingToRemove))} and moved ${votes.length} votes.`,
      )
    }

    // Final single update for companies, agenda, and comments
    try {
      const finalCompanies = Array.from(companiesSet)
      const updatedAgenda = agendaMapGlobal ? Array.from(agendaMapGlobal.values()) : undefined
      const finalFunds = Array.from(fundsSet)
      const finalFundsWithHolding = fundsWithHoldingAcc
      const finalLegacyIds = Array.from(legacyIdSet)

      const existingMigrationComments = (meetingToKeep as any)?.migrationComments || ''
      const summaryHeader = `UnifyMeetings migration summary for key ${groupKey} on ${new Date().toISOString()}`
      const companiesSummary = `- Companies merged total: ${finalCompanies.length}`
      const votesSummary = `- Total votes moved: ${totalVotesMoved}`
      const removedSummary = removedMeetingIds.length
        ? `- Removed meetings: ${removedMeetingIds.join(',')}`
        : '- Removed meetings: none'
      const agendaSummary = `- Agenda items updated (base rec differed): ${agendaChangesCount}`
      const fundsSummary = `- Funds merged total: ${finalFunds.length} (+${fundsAddedFromRemoved} from removed)`
      const fundsWithHoldingSummary = `- FundsWithHolding rows merged total: ${finalFundsWithHolding.length} (+${fundsWithHoldingAddedFromRemoved} from removed)`
      const legacyIdsSummary = `- LegacyIds appended from removed meetings: +${legacyIdsAddedFromRemoved}`

      const finalSummary = [
        summaryHeader,
        removedSummary,
        votesSummary,
        companiesSummary,
        agendaSummary,
        fundsSummary,
        fundsWithHoldingSummary,
        legacyIdsSummary,
        ...summaryLines,
      ].join('\n')

      const newMigrationComments = existingMigrationComments
        ? `${existingMigrationComments}\n\n${finalSummary}`
        : finalSummary

      await payload.update({
        collection: 'meetings',
        id: meetingToKeep.id,
        data: {
          ...(updatedAgenda ? { agenda: updatedAgenda } : {}),
          companies: finalCompanies,
          funds: finalFunds,
          fundsWithHolding: finalFundsWithHolding as any,
          legacyIds: finalLegacyIds as any,
          // finalized is unified: true only if all merged meetings were finalized=true; false otherwise
          finalized: allFinalized,
          migrationComments: newMigrationComments,
        },
        req: {
          ...req,
          context: { ...req.context, from: 'migration', process: 'unifyMeetings' },
        },
      })
    } catch (e) {
      console.warn('Warning: final update failed for meeting', displayId(meetingToKeep), e)
    }

    // Allow garbage collection to run after processing each meeting group
    await delay(200)

    return true
  } catch (error: any) {
    console.error(`✗ Failed to process group: ${groupKey}:`, error)

    await logMigrationFault({
      payload,
      type: 'meeting-unification',
      typeId: groupKey,
      severity: 'fatal',
      comments: `Failed to unify meetings with key ${groupKey}: ${error.message}`,
    })

    return false
  }
}

// Process meetings in batches to reduce memory usage
async function processMeetingsInBatches(
  payload: any,
  req: any,
  batchSize: number = 500,
): Promise<Meeting[]> {
  console.log(`Processing meetings in batches of ${batchSize}...`)

  let allMeetings: Meeting[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    console.log(`Fetching batch ${page}...`)
    const result = await payload.find({
      collection: 'meetings',
      limit: batchSize,
      where: { _status: { equals: 'published' } },
      page: page,
      depth: 0,
    })

    if (result.docs.length > 0) {
      allMeetings = [...allMeetings, ...(result.docs as Meeting[])]
      console.log(`Retrieved ${result.docs.length} meetings in batch ${page}`)
      page++

      // Allow garbage collection to run between batches
      await delay(500)
    } else {
      hasMore = false
    }
  }

  return allMeetings
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  try {
    console.log('Starting UnifyMeetings migration process...')

    // Process meetings in batches to reduce memory usage
    const allMeetings = await processMeetingsInBatches(payload, req)
    console.log(`Retrieved ${allMeetings.length} meetings in total`)

    // Process only NON-finalized meetings for unification
    const nonFinalizedMeetings = allMeetings.filter((m: any) => m?.finalized !== true)
    console.log(
      `Filtered to ${nonFinalizedMeetings.length} non-finalized meetings for duplicate detection`,
    )

    // Group meetings by composite key
    const meetingsByKey = new Map<string, Meeting[]>()

    for (const meeting of nonFinalizedMeetings) {
      const key = generateMeetingKey(meeting)

      if (!meetingsByKey.has(key)) {
        meetingsByKey.set(key, [])
      }

      meetingsByKey.get(key)?.push(meeting)
    }

    console.log(`Found ${meetingsByKey.size} unique meeting groups`)

    // Filter to only keep groups with more than one meeting (duplicates)
    const duplicateGroups = Array.from(meetingsByKey.entries()).filter(
      ([_, meetings]) => meetings.length > 1,
    )

    console.log(`Found ${duplicateGroups.length} groups with duplicate meetings`)

    // Process duplicate groups in smaller batches to reduce memory usage
    const BATCH_SIZE = 50
    const totalBatches = Math.ceil(duplicateGroups.length / BATCH_SIZE)
    console.log(`Processing duplicate groups in ${totalBatches} batches of ${BATCH_SIZE}...`)

    // Process each group of duplicate meetings
    let successCount = 0
    let errorCount = 0

    // Create a promise pool with 3 concurrent threads to reduce memory usage
    const promisePool = new PromisePool(3)

    // Process in smaller batches to reduce memory usage
    const batches = []

    // Split duplicateGroups into smaller batches
    for (let i = 0; i < duplicateGroups.length; i += BATCH_SIZE) {
      batches.push(duplicateGroups.slice(i, i + BATCH_SIZE))
    }

    console.log(`Split ${duplicateGroups.length} duplicate groups into ${batches.length} batches`)

    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(
        `Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} groups...`,
      )

      // Add all items in this batch to the promise pool
      const batchPromises = []
      for (const [groupKey, meetings] of batch) {
        batchPromises.push(
          promisePool.add(async () => {
            try {
              const success = await processMeetingGroup(payload, req, meetings, groupKey)
              if (success) {
                successCount++
                console.log(`✓ Successfully processed group: ${groupKey}`)
              } else {
                errorCount++
              }

              // Explicitly clean up large objects to help with garbage collection
              meetings.length = 0
            } catch (error: any) {
              errorCount++
              console.error(`✗ Failed to process group: ${groupKey}:`, error)

              await logMigrationFault({
                payload,
                severity: 'fatal',
                type: 'meeting-unification',
                typeId: groupKey,
                comments: `Failed to unify meetings with key ${groupKey}: ${error.message}`,
              })
            }
          }),
        )
      }

      // Wait for all promises in this batch to complete
      await Promise.all(batchPromises)

      // Add a delay between batches to allow garbage collection
      console.log(
        `Batch ${batchIndex + 1}/${batches.length} completed. Pausing to allow garbage collection...`,
      )
      await delay(1000)

      // Explicitly trigger garbage collection if possible
      if (global.gc) {
        console.log('Triggering garbage collection...')
        global.gc()
      }
    }

    // Total counts
    const totalSuccessCount = successCount
    const totalErrorCount = errorCount
    const totalGroupsProcessed = duplicateGroups.length

    console.log('\nMigration Summary:')
    console.log(`Total duplicate groups processed: ${totalGroupsProcessed}`)
    console.log(`Successfully processed: ${totalSuccessCount}`)
    console.log(`Failed processing: ${totalErrorCount}`)
    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Critical error during migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  }
}

// export async function down({ payload, req }: MigrateDownArgs): Promise
