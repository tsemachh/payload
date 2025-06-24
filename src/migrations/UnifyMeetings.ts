import { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { logMigrationFault } from '@/utils/migrationFaultUtils'
import { PromisePool } from '@/utils/promisePool'
import { Meeting, Stock, Vote } from '@/payload-types'

/**
 * Migration to unify duplicate meetings in the system
 *
 * Duplication happens because of 2 reasons:
 * 1. The need to provide different recommendations for the agenda items
 * 2. Dual stocks (stocks that exist in both Israeli and foreign stock exchanges)
 *
 * This migration:
 * - Finds all meetings in the system
 * - Aggregates them by magnaId (proofId)
 * - Also aggregates meetings without magnaId by invitationLink
 * - Only unifies meetings with the same meeting date
 * - Keeps one meeting per magnaId/invitationLink and purges the duplicates
 * - Moves votes from duplicate meetings to the kept meeting
 * - Handles different recommendations per company in the agenda items
 * - For meetings with different stocks:
 *   - Keeps the meeting with the stock that has fromMagna:true
 *   - Updates other stocks to have their relatedStock set to the magna stock
 *   - If no stock has fromMagna:true, falls back to keeping the oldest meeting
 */
// Helper function to introduce a small delay to allow garbage collection
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to group meetings by meeting date
function groupMeetingsByDate(meetings: Meeting[]): Map<string, Meeting[]> {
  const meetingsByDate = new Map<string, Meeting[]>()

  for (const meeting of meetings) {
    // Use the meeting date as the key, or 'null' if no date
    const dateKey = meeting.meetingDate || 'null'

    if (!meetingsByDate.has(dateKey)) {
      meetingsByDate.set(dateKey, [])
    }

    meetingsByDate.get(dateKey)?.push(meeting)
  }

  return meetingsByDate
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

    // Group meetings by magnaId (proofId)
    const meetingsByMagnaId = new Map<string, Meeting[]>()

    for (const meeting of allMeetings) {
      if (!meeting.magnaId) {
        // Skip meetings without magnaId
        continue
      }

      if (!meetingsByMagnaId.has(meeting.magnaId)) {
        meetingsByMagnaId.set(meeting.magnaId, [])
      }

      meetingsByMagnaId.get(meeting.magnaId)?.push(meeting)
    }

    console.log(`Found ${meetingsByMagnaId.size} unique magnaIds`)

    // Filter to only keep groups with more than one meeting (duplicates)
    const duplicateGroups = Array.from(meetingsByMagnaId.entries()).filter(
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
      for (const [magnaId, meetings] of batch) {
        batchPromises.push(
          promisePool.add(async () => {
            try {
              console.log(`Processing magnaId: ${magnaId} with ${meetings.length} meetings`)

              // Group meetings by meeting date
              const meetingsByDate = groupMeetingsByDate(meetings)
              console.log(`Meetings for magnaId ${magnaId} are grouped into ${meetingsByDate.size} different dates`)

              // If there are multiple date groups, we'll process each separately
              if (meetingsByDate.size > 1) {
                console.log(`Meetings for magnaId ${magnaId} have different dates, processing each date group separately`)

                // Process each date group that has more than one meeting
                for (const [dateKey, meetingsWithSameDate] of meetingsByDate.entries()) {
                  if (meetingsWithSameDate.length > 1) {
                    console.log(`Processing ${meetingsWithSameDate.length} meetings for magnaId ${magnaId} with date ${dateKey}`)

                    // Continue with the existing logic but for this date group
                    const stockIds = new Set(meetingsWithSameDate.map((meeting) => meeting.stock))

                    // Declare variables for meeting to keep and meetings to remove
                    let meetingToKeep: Meeting
                    let meetingsToRemove: Meeting[]

                    // If all meetings have the same stock, sort by creation date
                    if (stockIds.size === 1) {
                      // Sort meetings by creation date (oldest first) to keep the original one
                      const sortedMeetings = [...meetingsWithSameDate].sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                        return dateA - dateB
                      })

                      // Keep the first meeting and merge data from others
                      meetingToKeep = sortedMeetings[0]
                      meetingsToRemove = sortedMeetings.slice(1)
                    }
                    // If meetings have different stocks, prioritize the one with fromMagna:true
                    else {
                      console.log(
                        `Meetings for magnaId ${magnaId} with date ${dateKey} have different stocks: ${Array.from(stockIds).join(', ')}`,
                      )

                      // Fetch stock details for all meetings
                      const stockDetailsMap = new Map<string, Stock>()

                      for (const stockId of stockIds) {
                        try {
                          const stock = (await payload.findByID({
                            collection: 'stocks',
                            id: stockId as string,
                          })) as Stock

                          stockDetailsMap.set(stockId as string, stock)
                        } catch (error) {
                          console.error(`Failed to fetch stock with ID ${stockId}:`, error)
                        }
                      }

                      // Find the stock with fromMagna:true
                      const magnaStockId = Array.from(stockDetailsMap.entries()).find(
                        ([_, stock]) => stock.fromMagna === true,
                      )?.[0]

                      // If no stock has fromMagna:true, fall back to the oldest meeting
                      if (!magnaStockId) {
                        console.log(
                          `No stock with fromMagna:true found for magnaId ${magnaId} with date ${dateKey}, falling back to oldest meeting`,
                        )

                        // Sort meetings by creation date (oldest first)
                        const sortedMeetings = [...meetingsWithSameDate].sort((a, b) => {
                          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                          return dateA - dateB
                        })

                        // Keep the first meeting and merge data from others
                        meetingToKeep = sortedMeetings[0]
                        meetingsToRemove = sortedMeetings.slice(1)
                      } else {
                        console.log(
                          `Found stock with fromMagna:true (ID: ${magnaStockId}) for magnaId ${magnaId} with date ${dateKey}`,
                        )

                        // Find the meeting with the magna stock
                        const meetingWithMagnaStock = meetingsWithSameDate.find(
                          (meeting) => meeting.stock === magnaStockId,
                        )

                        if (!meetingWithMagnaStock) {
                          throw new Error(`Could not find meeting with magna stock ID ${magnaStockId}`)
                        }

                        // Keep the meeting with the magna stock and remove others
                        meetingToKeep = meetingWithMagnaStock
                        meetingsToRemove = meetingsWithSameDate.filter((meeting) => meeting.id !== meetingToKeep.id)

                        // Update relatedStock for all other stocks to point to the magna stock
                        for (const stockId of stockIds) {
                          if (stockId !== magnaStockId) {
                            console.log(
                              `Updating relatedStock for stock ${stockId} to point to magna stock ${magnaStockId}`,
                            )

                            try {
                              await payload.update({
                                collection: 'stocks',
                                id: stockId as string,
                                data: {
                                  relatedStock: magnaStockId,
                                },
                                req: {
                                  ...req,
                                  context: { ...req.context, from: 'migration' },
                                },
                              })
                            } catch (error) {
                              console.error(`Failed to update relatedStock for stock ${stockId}:`, error)
                            }
                          }
                        }
                      }
                    }

                    console.log(
                      `Keeping meeting ${meetingToKeep.id}, removing ${meetingsToRemove.length} duplicates for magnaId ${magnaId} with date ${dateKey}`,
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

                      // Move votes to the kept meeting
                      for (const vote of votes) {
                        await payload.update({
                          collection: 'votes',
                          id: vote.id,
                          data: {
                            meeting: meetingToKeep.id,
                          },
                          req: {
                            ...req,
                            context: { ...req.context, from: 'migration' },
                          },
                        })
                      }

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

                              // Add companies from the removed item's exceptional recommendation
                              if (item.exceptionalRecommendation.companies) {
                                keptItem.exceptionalRecommendation.companies = [
                                  ...(keptItem.exceptionalRecommendation.companies || []),
                                  ...(item.exceptionalRecommendation.companies || []),
                                ]
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
                  } else {
                    console.log(`Only one meeting for magnaId ${magnaId} with date ${dateKey}, no unification needed`)
                  }
                }

                // Skip the rest of the processing for this magnaId since we've handled each date group
                return
              }

              // If all meetings have the same date (or no date), proceed with the original logic
              console.log(`All meetings for magnaId ${magnaId} have the same date, proceeding with unification`)

              // Check if meetings have different stocks
              const stockIds = new Set(meetings.map((meeting) => meeting.stock))

              // Declare variables for meeting to keep and meetings to remove
              let meetingToKeep: Meeting
              let meetingsToRemove: Meeting[]

              // If all meetings have the same stock, sort by creation date
              if (stockIds.size === 1) {
                // Sort meetings by creation date (oldest first) to keep the original one
                const sortedMeetings = [...meetings].sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                  return dateA - dateB
                })

                // Keep the first meeting and merge data from others
                meetingToKeep = sortedMeetings[0]
                meetingsToRemove = sortedMeetings.slice(1)
              }
              // If meetings have different stocks, prioritize the one with fromMagna:true
              else {
                console.log(
                  `Meetings for magnaId ${magnaId} have different stocks: ${Array.from(stockIds).join(', ')}`,
                )

                // Fetch stock details for all meetings
                const stockDetailsMap = new Map<string, Stock>()

                for (const stockId of stockIds) {
                  try {
                    const stock = (await payload.findByID({
                      collection: 'stocks',
                      id: stockId as string,
                    })) as Stock

                    stockDetailsMap.set(stockId as string, stock)
                  } catch (error) {
                    console.error(`Failed to fetch stock with ID ${stockId}:`, error)
                  }
                }

                // Find the stock with fromMagna:true
                const magnaStockId = Array.from(stockDetailsMap.entries()).find(
                  ([_, stock]) => stock.fromMagna === true,
                )?.[0]

                // If no stock has fromMagna:true, fall back to the oldest meeting
                if (!magnaStockId) {
                  console.log(
                    `No stock with fromMagna:true found for magnaId ${magnaId}, falling back to oldest meeting`,
                  )

                  // Sort meetings by creation date (oldest first)
                  const sortedMeetings = [...meetings].sort((a, b) => {
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                    return dateA - dateB
                  })

                  // Keep the first meeting and merge data from others
                  meetingToKeep = sortedMeetings[0]
                  meetingsToRemove = sortedMeetings.slice(1)
                } else {
                  console.log(
                    `Found stock with fromMagna:true (ID: ${magnaStockId}) for magnaId ${magnaId}`,
                  )

                  // Find the meeting with the magna stock
                  const meetingWithMagnaStock = meetings.find(
                    (meeting) => meeting.stock === magnaStockId,
                  )

                  if (!meetingWithMagnaStock) {
                    throw new Error(`Could not find meeting with magna stock ID ${magnaStockId}`)
                  }

                  // Keep the meeting with the magna stock and remove others
                  meetingToKeep = meetingWithMagnaStock
                  meetingsToRemove = meetings.filter((meeting) => meeting.id !== meetingToKeep.id)

                  // Update relatedStock for all other stocks to point to the magna stock
                  for (const stockId of stockIds) {
                    if (stockId !== magnaStockId) {
                      console.log(
                        `Updating relatedStock for stock ${stockId} to point to magna stock ${magnaStockId}`,
                      )

                      try {
                        await payload.update({
                          collection: 'stocks',
                          id: stockId as string,
                          data: {
                            relatedStock: magnaStockId,
                          },
                          req: {
                            ...req,
                            context: { ...req.context, from: 'migration' },
                          },
                        })
                      } catch (error) {
                        console.error(`Failed to update relatedStock for stock ${stockId}:`, error)
                      }
                    }
                  }
                }
              }

              console.log(
                `Keeping meeting ${meetingToKeep.id}, removing ${meetingsToRemove.length} duplicates`,
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

                // Move votes to the kept meeting
                for (const vote of votes) {
                  await payload.update({
                    collection: 'votes',
                    id: vote.id,
                    data: {
                      meeting: meetingToKeep.id,
                    },
                    req: {
                      ...req,
                      context: { ...req.context, from: 'migration' },
                    },
                  })
                }

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

                        // Add companies from the removed item's exceptional recommendation
                        if (item.exceptionalRecommendation.companies) {
                          keptItem.exceptionalRecommendation.companies = [
                            ...(keptItem.exceptionalRecommendation.companies || []),
                            ...(item.exceptionalRecommendation.companies || []),
                          ]
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

              successCount++
              console.log(`✓ Successfully processed magnaId: ${magnaId}`)
            } catch (error: any) {
              errorCount++
              console.error(`✗ Failed to process magnaId: ${magnaId}:`, error)

              await logMigrationFault({
                payload,
                type: 'meeting-unification',
                typeId: magnaId,
                comments: `Failed to unify meetings with magnaId ${magnaId}: ${error.message}`,
              })
            }

            // Explicitly clean up large objects to help with garbage collection
            meetings.length = 0
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

    // Now process meetings without magnaId but with the same invitationLink
    console.log('\nProcessing meetings without magnaId but with the same invitationLink...')

    // Group meetings by invitationLink (only those without magnaId)
    const meetingsByInvitationLink = new Map<string, Meeting[]>()

    for (const meeting of allMeetings) {
      // Skip meetings with magnaId (already processed) or without invitationLink
      if (meeting.magnaId || !meeting.invitationLink) {
        continue
      }

      if (!meetingsByInvitationLink.has(meeting.invitationLink)) {
        meetingsByInvitationLink.set(meeting.invitationLink, [])
      }

      meetingsByInvitationLink.get(meeting.invitationLink)?.push(meeting)
    }

    console.log(
      `Found ${meetingsByInvitationLink.size} unique invitationLinks for meetings without magnaId`,
    )

    // Filter to only keep groups with more than one meeting (duplicates)
    const invitationLinkDuplicateGroups = Array.from(meetingsByInvitationLink.entries()).filter(
      ([_, meetings]) => meetings.length > 1,
    )

    console.log(
      `Found ${invitationLinkDuplicateGroups.length} groups with duplicate meetings by invitationLink`,
    )

    // Process each group of duplicate meetings by invitationLink
    let invitationLinkSuccessCount = 0
    let invitationLinkErrorCount = 0

    // Reuse the same promise pool
    const invitationLinkPromises = []

    for (const [invitationLink, meetings] of invitationLinkDuplicateGroups) {
      invitationLinkPromises.push(
        promisePool.add(async () => {
          try {
            console.log(
              `Processing invitationLink: ${invitationLink} with ${meetings.length} meetings`,
            )

            // Group meetings by meeting date
            const meetingsByDate = groupMeetingsByDate(meetings)
            console.log(`Meetings for invitationLink ${invitationLink} are grouped into ${meetingsByDate.size} different dates`)

            // If there are multiple date groups, we'll process each separately
            if (meetingsByDate.size > 1) {
              console.log(`Meetings for invitationLink ${invitationLink} have different dates, processing each date group separately`)

              // Process each date group that has more than one meeting
              for (const [dateKey, meetingsWithSameDate] of meetingsByDate.entries()) {
                if (meetingsWithSameDate.length > 1) {
                  console.log(`Processing ${meetingsWithSameDate.length} meetings for invitationLink ${invitationLink} with date ${dateKey}`)

                  // Continue with the existing logic but for this date group
                  const stockIds = new Set(meetingsWithSameDate.map((meeting) => meeting.stock))

                  // Declare variables for meeting to keep and meetings to remove
                  let meetingToKeep: Meeting
                  let meetingsToRemove: Meeting[]

                  // If all meetings have the same stock, sort by creation date
                  if (stockIds.size === 1) {
                    // Sort meetings by creation date (oldest first) to keep the original one
                    const sortedMeetings = [...meetingsWithSameDate].sort((a, b) => {
                      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                      return dateA - dateB
                    })

                    // Keep the first meeting and merge data from others
                    meetingToKeep = sortedMeetings[0]
                    meetingsToRemove = sortedMeetings.slice(1)
                  }
                  // If meetings have different stocks, prioritize the one with fromMagna:true
                  else {
                    console.log(
                      `Meetings for invitationLink ${invitationLink} with date ${dateKey} have different stocks: ${Array.from(stockIds).join(', ')}`,
                    )

                    // Fetch stock details for all meetings
                    const stockDetailsMap = new Map<string, Stock>()

                    for (const stockId of stockIds) {
                      try {
                        const stock = (await payload.findByID({
                          collection: 'stocks',
                          id: stockId as string,
                        })) as Stock

                        stockDetailsMap.set(stockId as string, stock)
                      } catch (error) {
                        console.error(`Failed to fetch stock with ID ${stockId}:`, error)
                      }
                    }

                    // Find the stock with fromMagna:true
                    const magnaStockId = Array.from(stockDetailsMap.entries()).find(
                      ([_, stock]) => stock.fromMagna === true,
                    )?.[0]

                    // If no stock has fromMagna:true, fall back to the oldest meeting
                    if (!magnaStockId) {
                      console.log(
                        `No stock with fromMagna:true found for invitationLink ${invitationLink} with date ${dateKey}, falling back to oldest meeting`,
                      )

                      // Sort meetings by creation date (oldest first)
                      const sortedMeetings = [...meetingsWithSameDate].sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                        return dateA - dateB
                      })

                      // Keep the first meeting and merge data from others
                      meetingToKeep = sortedMeetings[0]
                      meetingsToRemove = sortedMeetings.slice(1)
                    } else {
                      console.log(
                        `Found stock with fromMagna:true (ID: ${magnaStockId}) for invitationLink ${invitationLink} with date ${dateKey}`,
                      )

                      // Find the meeting with the magna stock
                      const meetingWithMagnaStock = meetingsWithSameDate.find(
                        (meeting) => meeting.stock === magnaStockId,
                      )

                      if (!meetingWithMagnaStock) {
                        throw new Error(`Could not find meeting with magna stock ID ${magnaStockId}`)
                      }

                      // Keep the meeting with the magna stock and remove others
                      meetingToKeep = meetingWithMagnaStock
                      meetingsToRemove = meetingsWithSameDate.filter((meeting) => meeting.id !== meetingToKeep.id)

                      // Update relatedStock for all other stocks to point to the magna stock
                      for (const stockId of stockIds) {
                        if (stockId !== magnaStockId) {
                          console.log(
                            `Updating relatedStock for stock ${stockId} to point to magna stock ${magnaStockId}`,
                          )

                          try {
                            await payload.update({
                              collection: 'stocks',
                              id: stockId as string,
                              data: {
                                relatedStock: magnaStockId,
                              },
                              req: {
                                ...req,
                                context: { ...req.context, from: 'migration' },
                              },
                            })
                          } catch (error) {
                            console.error(`Failed to update relatedStock for stock ${stockId}:`, error)
                          }
                        }
                      }
                    }
                  }

                  console.log(
                    `Keeping meeting ${meetingToKeep.id}, removing ${meetingsToRemove.length} duplicates for invitationLink ${invitationLink} with date ${dateKey}`,
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

                    // Move votes to the kept meeting
                    for (const vote of votes) {
                      await payload.update({
                        collection: 'votes',
                        id: vote.id,
                        data: {
                          meeting: meetingToKeep.id,
                        },
                        req: {
                          ...req,
                          context: { ...req.context, from: 'migration' },
                        },
                      })
                    }

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
                            // If the kept item doesn't have exceptional recommendations yet, initialize it
                            if (!keptItem.exceptionalRecommendation?.showExceptional) {
                              keptItem.exceptionalRecommendation = {
                                showExceptional: true,
                                companies: [],
                                votingRecommendation: item.exceptionalRecommendation.votingRecommendation,
                                reasonRef: item.exceptionalRecommendation.reasonRef,
                                reasonText: item.exceptionalRecommendation.reasonText,
                              }
                            }

                            // Add companies from the removed item's exceptional recommendation
                            if (item.exceptionalRecommendation.companies) {
                              keptItem.exceptionalRecommendation.companies = [
                                ...(keptItem.exceptionalRecommendation.companies || []),
                                ...(item.exceptionalRecommendation.companies || []),
                              ]
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
                } else {
                  console.log(`Only one meeting for invitationLink ${invitationLink} with date ${dateKey}, no unification needed`)
                }
              }

              // Skip the rest of the processing for this invitationLink since we've handled each date group
              return
            }

            // If all meetings have the same date (or no date), proceed with the original logic
            console.log(`All meetings for invitationLink ${invitationLink} have the same date, proceeding with unification`)

            // Check if meetings have different stocks
            const stockIds = new Set(meetings.map((meeting) => meeting.stock))

            // Declare variables for meeting to keep and meetings to remove
            let meetingToKeep: Meeting
            let meetingsToRemove: Meeting[]

            // If all meetings have the same stock, sort by creation date
            if (stockIds.size === 1) {
              // Sort meetings by creation date (oldest first) to keep the original one
              const sortedMeetings = [...meetings].sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return dateA - dateB
              })

              // Keep the first meeting and merge data from others
              meetingToKeep = sortedMeetings[0]
              meetingsToRemove = sortedMeetings.slice(1)
            }
            // If meetings have different stocks, prioritize the one with fromMagna:true
            else {
              console.log(
                `Meetings for invitationLink ${invitationLink} have different stocks: ${Array.from(stockIds).join(', ')}`,
              )

              // Fetch stock details for all meetings
              const stockDetailsMap = new Map<string, Stock>()

              for (const stockId of stockIds) {
                try {
                  const stock = (await payload.findByID({
                    collection: 'stocks',
                    id: stockId as string,
                  })) as Stock

                  stockDetailsMap.set(stockId as string, stock)
                } catch (error) {
                  console.error(`Failed to fetch stock with ID ${stockId}:`, error)
                }
              }

              // Find the stock with fromMagna:true
              const magnaStockId = Array.from(stockDetailsMap.entries()).find(
                ([_, stock]) => stock.fromMagna === true,
              )?.[0]

              // If no stock has fromMagna:true, fall back to the oldest meeting
              if (!magnaStockId) {
                console.log(
                  `No stock with fromMagna:true found for invitationLink ${invitationLink}, falling back to oldest meeting`,
                )

                // Sort meetings by creation date (oldest first)
                const sortedMeetings = [...meetings].sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
                  return dateA - dateB
                })

                // Keep the first meeting and merge data from others
                meetingToKeep = sortedMeetings[0]
                meetingsToRemove = sortedMeetings.slice(1)
              } else {
                console.log(
                  `Found stock with fromMagna:true (ID: ${magnaStockId}) for invitationLink ${invitationLink}`,
                )

                // Find the meeting with the magna stock
                const meetingWithMagnaStock = meetings.find(
                  (meeting) => meeting.stock === magnaStockId,
                )

                if (!meetingWithMagnaStock) {
                  throw new Error(`Could not find meeting with magna stock ID ${magnaStockId}`)
                }

                // Keep the meeting with the magna stock and remove others
                meetingToKeep = meetingWithMagnaStock
                meetingsToRemove = meetings.filter((meeting) => meeting.id !== meetingToKeep.id)

                // Update relatedStock for all other stocks to point to the magna stock
                for (const stockId of stockIds) {
                  if (stockId !== magnaStockId) {
                    console.log(
                      `Updating relatedStock for stock ${stockId} to point to magna stock ${magnaStockId}`,
                    )

                    try {
                      await payload.update({
                        collection: 'stocks',
                        id: stockId as string,
                        data: {
                          relatedStock: magnaStockId,
                        },
                        req: {
                          ...req,
                          context: { ...req.context, from: 'migration' },
                        },
                      })
                    } catch (error) {
                      console.error(`Failed to update relatedStock for stock ${stockId}:`, error)
                    }
                  }
                }
              }
            }

            console.log(
              `Keeping meeting ${meetingToKeep.id}, removing ${meetingsToRemove.length} duplicates`,
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

              // Move votes to the kept meeting
              for (const vote of votes) {
                await payload.update({
                  collection: 'votes',
                  id: vote.id,
                  data: {
                    meeting: meetingToKeep.id,
                  },
                  req: {
                    ...req,
                    context: { ...req.context, from: 'migration' },
                  },
                })
              }

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
                      // If the kept item doesn't have exceptional recommendations yet, initialize it
                      if (!keptItem.exceptionalRecommendation?.showExceptional) {
                        keptItem.exceptionalRecommendation = {
                          showExceptional: true,
                          companies: [],
                          votingRecommendation: item.exceptionalRecommendation.votingRecommendation,
                          reasonRef: item.exceptionalRecommendation.reasonRef,
                          reasonText: item.exceptionalRecommendation.reasonText,
                        }
                      }

                      // Add companies from the removed item's exceptional recommendation
                      if (item.exceptionalRecommendation.companies) {
                        keptItem.exceptionalRecommendation.companies = [
                          ...(keptItem.exceptionalRecommendation.companies || []),
                          ...(item.exceptionalRecommendation.companies || []),
                        ]
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

            // Allow garbage collection to run after processing each invitationLink group
            await delay(200)

            invitationLinkSuccessCount++
            console.log(`✓ Successfully processed invitationLink: ${invitationLink}`)
          } catch (error: any) {
            invitationLinkErrorCount++
            console.error(`✗ Failed to process invitationLink: ${invitationLink}:`, error)

            await logMigrationFault({
              payload,
              type: 'meeting-unification',
              typeId: invitationLink,
              comments: `Failed to unify meetings with invitationLink ${invitationLink}: ${error.message}`,
            })
          }

          // Explicitly clean up large objects to help with garbage collection
          meetings.length = 0
        }),
      )
    }

    // Wait for all invitationLink promises to complete
    await promisePool.waitForAll()

    // Total counts
    const totalSuccessCount = successCount + invitationLinkSuccessCount
    const totalErrorCount = errorCount + invitationLinkErrorCount
    const totalGroupsProcessed = duplicateGroups.length + invitationLinkDuplicateGroups.length

    console.log('\nMigration Summary:')
    console.log(`Total duplicate groups processed: ${totalGroupsProcessed}`)
    console.log(
      `By magnaId: ${duplicateGroups.length}, By invitationLink: ${invitationLinkDuplicateGroups.length}`,
    )
    console.log(`Successfully processed: ${totalSuccessCount}`)
    console.log(`Failed processing: ${totalErrorCount}`)
    console.log('Migration completed successfully.')
  } catch (error) {
    console.error('Critical error during migration:', error)
    throw error // Re-throw to ensure migration is marked as failed
  }
}

// export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
//   // Implement the down migration if needed
//   // This would be complex as it would need to recreate the duplicate meetings
// }
