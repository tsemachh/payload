import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
export type TopicType = 'reporting' | 'decision'

export const topicTypesMap: Map<string, TopicType> = new Map([
  ['לדיווח בלבד', 'reporting'],
  ['להחלטה', 'decision'],
])
export function getAgendaType(rowType: string): TopicType {
  return topicTypesMap.get((rowType || '').trim()) || 'decision'
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

  if ((label || '').trim() !== 'רוב רגיל') {
    return 'privileged'
  }
  return 'regular'
}
export const processMeetingsAgendaFeedCsv = async (
  req: PayloadRequest,
  doc: any,
): Promise<string[]> => {
  const errors: string[] = []
  try {
    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push('No file found in request')
      return errors
    }

    const csvData = iconv.decode(file.data, 'windows-1255')
    const results = csvToJson.fieldDelimiter('\t').csvStringToJson(csvData)

    const rowsByMagnaId = new Map<string, any[]>()

    results.forEach((data) => {
      const row = {
        text: data.topic || '',
        topicType: getAgendaType(data.MeetingType || '') as TopicType,
        magnaId: data.ProofId || '',
        majorityType: getMajorityType(data.MajorityRequired) || '',
        otherMajority: data.OtherMajority || '',
      }

      const magnaId = row.magnaId
      if (!rowsByMagnaId.has(magnaId)) {
        rowsByMagnaId.set(magnaId, [])
      }
      rowsByMagnaId.get(magnaId)?.push(row)
    })

    req.payload.logger.info(
      `Processing ${rowsByMagnaId.size} unique meetings from CSV file: ${file.name}`,
    )

    for (const [magnaId, agendaRows] of rowsByMagnaId.entries()) {
      try {
        const existingMeetings = await req.payload.find({
          collection: 'meetings',
          where: {
            magnaId: {
              equals: magnaId,
            },
          },
          limit: 1,
        })

        if (existingMeetings.docs.length === 0) {
          errors.push(`No meeting found with magnaId ${magnaId}`)
          continue
        }

        for (const meeting of existingMeetings.docs) {
          await req.payload.update({
            collection: 'meetings',
            id: meeting.id,
            data: {
              agenda: agendaRows,
            },
            context: { ...req.context, from: 'migration' },
          })
        }
      } catch (error: any) {
        errors.push(`Error updating meetings for magnaId ${magnaId}: ${error.message}`)
      }
    }

    req.payload.logger.info(`Finished processing file: ${file.name}`)

    if (errors.length > 0) {
      console.error(`\nFinished with ${errors.length} errors:`)
      errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }

    return errors
  } catch (error) {
    req.payload.logger.error(`Error processing Meetings feed CSV: ${JSON.stringify(error)}`)
    errors.push(`Error processing Meetings feed CSV: ${JSON.stringify(error)}`)
    return errors
  }
}
