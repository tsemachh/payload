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
    text: rowObj.topic || '',
    topicType: getAgendaType(rowObj.topicType || '') as TopicType,
    majorityType: getMajorityType(rowObj.MajorityRequired) || '',
  }
  return row
}

export const processMeetingsAgendaFeedCsv = async (
  req: PayloadRequest,
  doc: any,
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

    req.payload.logger.info(
      `Processing ${rowsByMagnaId.size} unique meetings from CSV file: ${file.name}`,
      (fileLength = rowsByMagnaId.size),
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
      `Starting agenda update processing for ${rowsByMagnaId.size} meetings`,
      {
        fileName: file.name,
        totalMeetings: rowsByMagnaId.size,
        existingMeetings: existingMeetings.docs.length,
        nonExistingMeetings: nonExistingMagnaIds.length,
      },
    )

    for (const [magnaId, agendaRows] of Array.from(rowsByMagnaId.entries())) {
      const meeting = meetingsMap.get(magnaId)
      processedRows++

      if (!meeting) {
        // Skip non-existing meetings as we've already added an error for them
        continue
      }

      try {
        await req.payload
          .update({
            collection: 'meetings',
            id: meeting.id,
            data: { agenda: agendaRows },
            context: { ...req.context, from: 'migration' },
            req,
          })
          .catch((e) => {
            req.payload.logger.info(
              { agendaRows, meeting },
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
      } catch (e: any) {
        req.payload.logger.error(
          { agendaRows, meeting },
          `Finished processing file:   שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`,
        )
        errors.push(`  שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`)
      }
    }

    // Log agenda update processing completion
    req.payload.logger.info(`Finished processing agenda updates`, {
      fileName: file.name,
      totalProcessed: processedRows,
      successfulUpdates: successCount,
      agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
      agendaUpdatesCount: agendaUpdatedMeetingIds.length,
      errors: errors.length,
    })

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

      req.payload.logger.info(`Scheduled daily meeting notifications task with agenda updates`, {
        agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
        agendaUpdatesCount: agendaUpdatedMeetingIds.length,
      })
    } catch (schedulingError: any) {
      req.payload.logger.error(`Failed to schedule daily meeting notifications task`, {
        error: schedulingError.message,
        agendaUpdatedMeetingIds: agendaUpdatedMeetingIds,
      })
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
  } catch (e: any) {
    req.payload.logger.error(`Error processing Meetings feed CSV: ${e.message})}`)
    errors.push(`שגיאה בעיבוד קובץ האסיפות: ${e.message}`)
    return { errors, successCount, fileLength, agendaUpdatedMeetingIds }
  }
}
