import { PayloadRequest } from 'payload'
import { scheduleSendDailyMeetingNotificationsTask } from '@/tasks/scheduleDailyTasks'

export type TopicType = 'reporting' | 'decision'

export function getAgendaType(rowType: string): TopicType {
  return rowType === 'reporting' || rowType === 'decision' ? (rowType as TopicType) : 'decision'
}

export const majorityTypesMap: Map<string, 'regular' | 'privileged'> = new Map([
  ['רוב רגיל', 'regular'],
  ['רוב מיוחד', 'privileged'],
])

export function getMajorityType(label: string): 'regular' | 'privileged' {
  const mappedValue = majorityTypesMap.get((label || '').trim())
  if (mappedValue) {
    return mappedValue
  }
  return (label || '').trim() !== 'רוב רגיל' ? 'privileged' : 'regular'
}

export function convertMagnaAgendaToPayload(rowObj: Record<string, any>) {
  const row = {
    meetingItemIndex: rowObj.MeetingItemIndex || 0,
    text: rowObj.topic || '',
    topicType: getAgendaType(rowObj.topicType || '') as TopicType,
    majorityType: getMajorityType(rowObj.MajorityRequired) || '',
  }
  return row
}

export const processMeetingsAgendaFeedCsv = async (
  req: PayloadRequest,
  doc: Record<string, any>,
): Promise<{
  errors: string[]
  successCount: number
  fileLength: number
  agendaUpdatedMeetingIds: string[]
}> => {
  const errors: string[] = []
  let successCount = 0
  let fileLength = 0
  const agendaUpdatedMeetingIds: string[] = []

  try {
    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push('לא נמצא קובץ בבקשה')
      return { errors, successCount, fileLength, agendaUpdatedMeetingIds }
    }
    const jsonData = JSON.parse(file.data.toString('utf8'))
    const schema = Object.keys(jsonData.schema)
    const dataRows = jsonData.data

    let processedRows = 0
    const rowsByMagnaId = new Map<string, any[]>()

    dataRows.forEach((rowArray: any[]) => {
      const rowObj = schema.reduce(
        (acc, key, index) => {
          acc[key] = rowArray[index]
          return acc
        },
        {} as Record<string, any>,
      )
      const row = convertMagnaAgendaToPayload(rowObj)
      const magnaId = rowObj.ProofId || ''
      if (!rowsByMagnaId.has(magnaId)) {
        rowsByMagnaId.set(magnaId, [])
      }
      rowsByMagnaId.get(magnaId)?.push(row)
    })

    fileLength = rowsByMagnaId.size
    req.payload.logger.info(
      { fileLength },
      `Processing ${rowsByMagnaId.size} unique meetings from CSV file: ${file.name}`
    )
    const magnaIds = Array.from(rowsByMagnaId.keys())
    const existingMeetings = await req.payload.find({
      collection: 'meetings',
      select: {
        magnaId: true,
      },
      where: {
        magnaId: {
          in: magnaIds,
        },
      },
      limit: 0,
      depth: 0,
    })
    req.payload.logger.info({ existingMeetings }, 'Getting meetings from CSV file')
    const meetingsMap = new Map<string, any>(
      existingMeetings.docs.map((meeting) => [String(meeting.magnaId || ''), meeting]),
    )

    // Calculate all magnaIds that don't exist in the database
    const nonExistingMagnaIds = Array.from(rowsByMagnaId.keys()).filter(
      (magnaId) => !meetingsMap.has(magnaId),
    )

    // Add a single error for all non-existing magnaIds
    if (nonExistingMagnaIds.length > 0) {
      req.payload.logger.error({ nonExistingMagnaIds }, `לא נמצאו אסיפות עם מספרי האסמכתא הבאים:`)
      errors.push(`לא נמצאו אסיפות עם מספרי האסמכתא הבאים: ${nonExistingMagnaIds.join(', ')}`)
    }

    // Log agenda update processing start
    req.payload.logger.info(
      {
        fileName: file.name,
        totalMeetings: rowsByMagnaId.size,
        existingMeetings: existingMeetings.docs.length,
        nonExistingMeetings: nonExistingMagnaIds.length,
      },
      `Starting agenda update processing for ${rowsByMagnaId.size} meetings`
    )

    for (const [magnaId, agendaRows] of Array.from(rowsByMagnaId.entries())) {
      const meeting = meetingsMap.get(magnaId)
      processedRows++

      if (!meeting) {
        // Skip non-existing meetings as we've already added an error for them
        continue
      }

      try {
        // Fetch the existing meeting with full agenda data
        const existingMeeting = await req.payload.findByID({
          collection: 'meetings',
          id: meeting.id,
          depth: 0,
        })

        // Create a map of updates by MeetingItemIndex (1-based from CSV)
        const updatesByIndex = new Map<number, Record<string, any>>()
        agendaRows.forEach((newItem: Record<string, any>) => {
          const itemIndex = newItem.meetingItemIndex || 0
          updatesByIndex.set(itemIndex, newItem)
        })

        // Start with existing agenda or empty array
        const existingAgenda = existingMeeting.agenda || []
        const mergedAgenda: Record<string, any>[] = []

        // Process each existing agenda item
        existingAgenda.forEach((existingItem: Record<string, any>, arrayIndex: number) => {
          // MeetingItemIndex is 1-based, array index is 0-based
          const itemIndex = arrayIndex + 1
          const updateItem = updatesByIndex.get(itemIndex)

          if (updateItem) {
            // We have an update for this item - merge it
            const mergedItem: Record<string, any> = { ...existingItem }

            // Iterate over all properties in updateItem and update only non-empty values
            Object.keys(updateItem).forEach((key) => {
              // Skip meetingItemIndex as it's just for matching
              if (key === 'meetingItemIndex') return

              const value = updateItem[key]

              // Only update if value is not empty
              // Handle strings: update if not empty after trim
              if (typeof value === 'string') {
                if (value.trim() !== '') {
                  mergedItem[key] = value
                }
              }
              // Handle other types: update if not null/undefined
              else if (value !== null && value !== undefined) {
                mergedItem[key] = value
              }
            })

            mergedAgenda.push(mergedItem)
            // Remove from map so we know it's been processed
            updatesByIndex.delete(itemIndex)
          } else {
            // No update for this item - keep it as is
            mergedAgenda.push(existingItem)
          }
        })

        // Handle any new items from CSV that don't exist in current agenda
        // (items with MeetingItemIndex > current agenda length)
        const remainingUpdates = Array.from(updatesByIndex.entries())
          .sort((a, b) => a[0] - b[0]) // Sort by index
          .map(([_index, item]) => {
            // Remove meetingItemIndex from the final item
            const { meetingItemIndex: _meetingItemIndex, ...itemWithoutIndex } = item
            return itemWithoutIndex
          })

        mergedAgenda.push(...remainingUpdates)

        await req.payload
          .update({
            collection: 'meetings',
            id: meeting.id,
            data: { agenda: mergedAgenda },
            context: { ...req.context, from: 'migration', process: 'processMeetingAgendaFeed' },
            req,
          })
          .catch((e) => {
            req.payload.logger.info(
              { agendaRows, meeting, mergedAgenda },
              `   שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`,
            )
          })

        // Track successfully updated meeting ID for daily notifications
        agendaUpdatedMeetingIds.push(meeting.id)
        successCount++

        // Notify progress every 10 meetings
        if (processedRows % 10 === 0) {
          const progressMsg = `Progress: ${processedRows}/${rowsByMagnaId.size} meetings processed (${Math.round((processedRows / rowsByMagnaId.size) * 100)}%)`
          console.log(progressMsg)
          req.payload.logger.info(progressMsg)
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        req.payload.logger.error(
          { agendaRows, meeting },
          `Finished processing file:   שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${errorMessage}`,
        )
        errors.push(`  שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${errorMessage}`)
      }
    }

    // Log agenda update processing completion
    req.payload.logger.info({
      fileName: file.name,
      totalProcessed: processedRows,
      successfulUpdates: successCount,
      agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
      agendaUpdatesCount: agendaUpdatedMeetingIds.length,
      errors: errors.length,
    }, `Finished processing agenda updates`)

    // Schedule daily notification task with agenda update data
    try {
      // Delete any existing scheduled daily notification tasks to prevent duplicates
      await req.payload.delete({
        collection: 'payload-jobs',
        where: {
          taskSlug: {
            equals: 'sendDailyMeetingNotifications',
          },
          totalTried: {
            equals: 0,
          },
        },
      })
      await scheduleSendDailyMeetingNotificationsTask(req.payload, agendaUpdatedMeetingIds)

      req.payload.logger.info({
        agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
        agendaUpdatesCount: agendaUpdatedMeetingIds.length,
      }, `Scheduled daily meeting notifications task with agenda updates`)
    } catch (schedulingError) {
      const errorMessage = schedulingError instanceof Error ? schedulingError.message : String(schedulingError)
      req.payload.logger.error({
        error: errorMessage,
        agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
      }, `Failed to schedule daily meeting notifications task`)
      // Don't add to errors array as this is not a critical failure for the agenda processing
    }

    req.payload.logger.info(`Finished processing file: ${file.name}`)
    if (errors.length > 0) {
      req.payload.logger.error(`\nFinished with ${errors.length} errors:`)
      errors.forEach((err, idx) => {
        req.payload.logger.error(`${idx + 1}. ${err}`)
      })
    }

    return { errors, successCount, fileLength, agendaUpdatedMeetingIds }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    req.payload.logger.error(`Error processing Meetings feed CSV: ${errorMessage})}`)
    errors.push(`שגיאה בעיבוד קובץ האסיפות: ${errorMessage}`)
    return { errors, successCount, fileLength, agendaUpdatedMeetingIds }
  }
}
