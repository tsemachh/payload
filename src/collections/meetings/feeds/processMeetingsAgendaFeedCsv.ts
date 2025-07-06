import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
import { PromisePool } from '@/utils/promisePool'

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

export const processMeetingsAgendaFeedCsv = async (
  req: PayloadRequest,
  doc: any,
): Promise<{ errors: string[]; successCount: number; fileLength: number }> => {
  const errors: string[] = []
  let successCount = 0
  let fileLength = 0
  try {
    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push('לא נמצא קובץ בבקשה')
      return { errors, successCount, fileLength }
    }
    const jsonData = JSON.parse(file.data.toString('utf8'))
    const schema = Object.keys(jsonData.schema)
    const dataRows = jsonData.data

    const rowsByMagnaId = new Map<string, any[]>()

    dataRows.forEach((rowArray: any[]) => {
      const rowObj = schema.reduce(
        (acc, key, index) => {
          acc[key] = rowArray[index]
          return acc
        },
        {} as Record<string, any>,
      )

      const row = {
        text: rowObj.topic || '',
        topicType: getAgendaType(rowObj.topicType || '') as TopicType,
        magnaId: rowObj.ProofId || '',
        majorityType: getMajorityType(rowObj.MajorityRequired) || '',
      }
      console.log('row', row)
      const magnaId = row.magnaId
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
      where: {
        magnaId: {
          in: magnaIds,
        },
      },
      limit: 0,
    })
    const meetingsMap = new Map<string, any>(
      existingMeetings.docs.map((meeting) => [meeting.magnaId || '', meeting]),
    )
    const promisePool = new PromisePool(20)
    const promises: Promise<void>[] = []

    for (const [magnaId, agendaRows] of rowsByMagnaId.entries()) {
      const meeting = meetingsMap.get(magnaId)
      if (!meeting) {
        errors.push(`  לא נמצאה אסיפה עם מספר האסמכתא ${magnaId} `)
        continue
      }

      promisePool.add(async () => {
        try {
          await req.payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: { agenda: agendaRows },
            context: { ...req.context, from: 'migration' },
            req,
          }).catch((e) => {
            req.payload.logger.info({agendaRows},`   שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`)
          })
          successCount++
        } catch (e: any) {
          req.payload.logger.error({agendaRows},`Finished processing file:   שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`)
          errors.push(`  שגיאה בעידכון אסיפה עם מספר  האסמכתא   ${magnaId}: ${e.message}`)
        }
      })
    }

    await promisePool.waitForAll()
    req.payload.logger.info(`Finished processing file: ${file.name}`)
    if (errors.length > 0) {
      console.error(`\nFinished with ${errors.length} errors:`)
      errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }

    return { errors, successCount, fileLength }
  } catch (e: any) {
    req.payload.logger.error(`Error processing Meetings feed CSV: ${e.message})}`)
    errors.push(`שגיאה בעיבוד קובץ האסיפות: ${e.message}`)
    return { errors, successCount, fileLength }
  }
}
