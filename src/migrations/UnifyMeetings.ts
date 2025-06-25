import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
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
  groupKey: string
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

    console.log(
      `Keeping meeting ${meetingToKeep.id}, removing ${meetingsToRemove.length} duplicates for key ${groupKey}`
    )

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
      })

      const votes = votesResult.docs as Vote[]
      console.log(`Found ${votes.length} votes for meeting ${meetingToRemove.id}`)

      // Collect companies from votes to add to the kept meeting
      const voteCompanies = votes.map((vote) => vote.company).filter(Boolean)

      if (voteCompanies.length > 0) {
        console.log(
          `Adding ${voteCompanies.length} companies from votes to meeting ${meetingToKeep.id}`
        )

        // Use companies directly from meetingToKeep
        const existingCompanies = meetingToKeep.companies || []
        const allCompanies = [...existingCompanies, ...voteCompanies]

        // Remove duplicates
        const uniqueCompanies = Array.from(new Set(allCompanies))

        // Update the kept meeting with the combined companies
        await payload.update({
          collection: 'meetings',
          id: meetingToKeep.id,
          data: {
            companies: uniqueCompanies,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration' },
          },
        })
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
          context: { ...req.context, from: 'migration' },
        },
      })

      // Merge agenda items with different recommendations
      if (meetingToKeep.agenda && meetingToRemove.agenda) {
        // Create a map of agenda items by topicIndex
        const agendaMap = new Map()

        // Initialize with the kept meeting's agenda
        meetingToKeep.agenda.forEach((item, index) => {
          agendaMap.set(index, { ...item })
        })

        // Process agenda items from the meeting to remove
        meetingToRemove.agenda.forEach((item, index) => {
          if (meetingToKeep?.agenda && index < meetingToKeep?.agenda?.length) {
            const keptItem = agendaMap.get(index)

            // If there's an exceptional recommendation in the item to remove
            if (
              item.exceptionalRecommendation?.showExceptional &&
              item.exceptionalRecommendation.companies &&
              item.exceptionalRecommendation.companies?.length > 0
            ) {
              // Check if the recommendations are different
              const keptItemRecommendation = keptItem.exceptionalRecommendation?.votingRecommendation || 
                keptItem.recommendation?.votingRecommendation;
              const isRecommendationDifferent = 
                item.exceptionalRecommendation.votingRecommendation !== keptItemRecommendation;

              // If the recommendations are different, set the exceptionalRecommendation in meetingToKeep
              // as in meetingToRemove and add the companies of meetingToRemove to the companies of the exceptionalRecommendation
              if (isRecommendationDifferent) {
                // If the kept item doesn't have exceptional recommendations yet, initialize it
                if (!keptItem.exceptionalRecommendation?.showExceptional) {
                  keptItem.exceptionalRecommendation = {
                    showExceptional: true,
                    companies: [],
                    votingRecommendation:
                      item.exceptionalRecommendation.votingRecommendation,
                    reasonRef: item.exceptionalRecommendation.reasonRef,
                    reasonText: item.exceptionalRecommendation.reasonText,
                  }
                }

                // Add companies from meetingToRemove to the exceptionalRecommendation companies
                if (meetingToRemove.companies && meetingToRemove.companies.length > 0) {
                  keptItem.exceptionalRecommendation.companies = [
                    ...(keptItem.exceptionalRecommendation.companies || []),
                    ...meetingToRemove.companies,
                  ]
                }
              } else {
                // If the recommendations are the same, just add companies from the removed item's exceptional recommendation
                if (item.exceptionalRecommendation.companies) {
                  keptItem.exceptionalRecommendation.companies = [
                    ...(keptItem.exceptionalRecommendation.companies || []),
                    ...(item.exceptionalRecommendation.companies || []),
                  ]
                }
              }
            }

            agendaMap.set(index, keptItem)
          }
        })

        // Update the kept meeting with merged agenda
        const updatedAgenda = Array.from(agendaMap.values())

        await payload.update({
          collection: 'meetings',
          id: meetingToKeep.id,
          data: {
            agenda: updatedAgenda,
          },
          req: {
            ...req,
            context: { ...req.context, from: 'migration' },
          },
        })
      }

      // Delete the duplicate meeting
      await payload.delete({
        collection: 'meetings',
        id: meetingToRemove.id,
        req: {
          ...req,
          context: { ...req.context, from: 'migration' },
        },
      })
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

    // Group meetings by composite key
    const meetingsByKey = new Map<string, Meeting[]>()

    for (const meeting of allMeetings) {
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
                type: 'meeting-unification',
                typeId: groupKey,
                comments: `Failed to unify meetings with key ${groupKey}: ${error.message}`,
              })
            }
          })
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
