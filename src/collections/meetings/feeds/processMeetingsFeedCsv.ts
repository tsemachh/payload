import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
import { getSequenceStockId, getStockByStockId } from '@/utils/utils'
import { parseDateString } from '@/utils/dateUtils'
import { MeetingState, MeetingType } from '@/payload-types'

export const meetingTypesMap: Map<string, MeetingType> = new Map([
  ['אסיפה מיוחדת', 'מיוחדת'],
  ['אסיפה שנתית', 'שנתית'],
  ['אסיפה כללית', 'שנתית'],
  ['אסיפה כללית שנתית', 'שנתית'],
  ['אסיפה כללית מיוחדת', 'מיוחדת'],
  ['אסיפת בעלי כתבי אופציה ', 'מיוחדת'],
  ['אסיפת מחזיקי אגרות חוב', 'אג"ח'],
])
export function getMeetingType(rowType: string): MeetingType {
  return meetingTypesMap.get((rowType || '').trim()) || 'מיוחדת'
}
export const meetingStateMap: Map<string, MeetingState> = new Map([
  ['מתוכננת', 'scheduled'],
  ['התקיימה', 'completed'],
  ['נדחית', 'postponed'],
  ['נדחית ללא מועד', 'on-hold'],
  ['נמשכת', 'ongoing'],
  ['בוטלה', 'cancelled'],
])

export function getMeetingState(stateLabel: string): MeetingState {
  return meetingStateMap.get((stateLabel || '').trim()) || 'scheduled'
}
const getMissingColumns = (rows: any[], fields: string[]): string[] => {
  return fields.filter((field) => rows.every((row) => !row[field]))
}

const getMissingFieldsInRow = (row: any, fields: string[]): string[] => {
  return fields.filter((field) => !row[field])
}
export const findMeetingByMagnaId = async (payload: any, magnaId: string) => {
  const result = await payload.find({
    collection: 'meetings',
    where: {
      magnaId: {
        equals: magnaId,
      },
    },
    limit: 1,
  })

  return result
}

const requiredFields = ['type', 'magnaId', 'meetingDate', 'holdingsLimit', 'location', 'stock']
export const processMeetingsFeedCsv = async (req: PayloadRequest, doc: any): Promise<string[]> => {
  const errors: string[] = []
  try {
    // The file is at req.file as specified in the issue description

    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push('No file found in request')
      return errors
    }

    // Read the file content
    const csvData = iconv.decode(file.data, 'windows-1255')

    const results = csvToJson.fieldDelimiter('\t').csvStringToJson(csvData)
    const rows: any[] = results.map((data) => {
      try {
        return {
          type: getMeetingType(data.MeetingType || '') as MeetingType,
          magnaId: data.ProofId || '',
          stock: data.stockID || '',
          meetingDate: data.mdate != '' ? parseDateString(data.mdate) : null,
          holdingsLimit: data.sdate != '' ? parseDateString(data.sdate) : null,
          location: data.location || '',
          state: getMeetingState(data.state || '') as MeetingState,
          ProofIdPrev: data.ProofIdPrev || '',
          _status: 'draft',
        }
      } catch (e: any) {
        errors.push(`Error processing row: ${JSON.stringify(data)} - ${e.message}`)
      }
    })

    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        console.log('Row:', row)
        const missingColumns = getMissingColumns(rows, requiredFields)
        if (missingColumns.length > 0) {
          errors.push(
            `CSV is missing required columns: ${missingColumns.join(', ')} (empty in all rows)`,
          )
          break
        }
        const missingFields = getMissingFieldsInRow(row, requiredFields)

        if (missingFields.length > 0) {
          errors.push(
            `Meeting with magnaId ${row.magnaId} is missing required fields: ${missingFields.join(', ')}`,
          )
          continue
        }
        const stockId = await getSequenceStockId(req.payload, row.stock)
        if (stockId === null) {
          errors.push(
            `Meeting with magnaId ${row.magnaId} has stockId ${row.stock} that can't be found and will not be imported — this meeting will NOT be created`,
          )
          continue
        }
        const stockData = await getStockByStockId(req.payload, row.stock)
        if (!stockData?.active) {
          errors.push(
            `Meeting with magnaId ${row.magnaId} has stockId ${row.stock} that is not active and will not be imported — this meeting will NOT be created`,
          )
          continue
        }
        row.stock = stockId
        if (row.ProofIdPrev) {
          const prevMeeting = await findMeetingByMagnaId(req.payload, row.ProofIdPrev)
          if (prevMeeting && prevMeeting.docs.length > 0) {
            const { magnaId, ...dataToUpdate } = row
            dataToUpdate.magnaId = row.ProofIdPrev
            delete dataToUpdate.ProofIdPrev
            const prevMeetingId = prevMeeting.docs[0].id
            try {
              await req.payload.update({
                collection: 'meetings',
                id: prevMeetingId,
                data: dataToUpdate,
                context: { ...req.context, from: 'migration' },
              })
              req.payload.logger.info(
                `Successfully updated meeting with ProofIdPrev ${row.ProofIdPrev}`,
              )
            } catch (e: any) {
              errors.push(
                `Error updating meeting with ProofIdPrev ${row.ProofIdPrev}: ${e.message}`,
              )
              req.payload.logger.error(`Error updating meeting with ProofIdPrev ${row.ProofIdPrev}`)
            }
          } else {
            errors.push(`No meeting found for ProofIdPrev ${row.ProofIdPrev}, cannot update`)
            req.payload.logger.warn(`No meeting found for ProofIdPrev ${row.ProofIdPrev}`)
          }
        }

        const existingMeeting = await findMeetingByMagnaId(req.payload, row.magnaId)
        if (existingMeeting?.docs.length > 0) {
          const meetingId = existingMeeting?.docs[0].id
          try {
            await req.payload.update({
              collection: 'meetings',
              id: meetingId,
              data: row,
              context: { ...req.context, from: 'migration' },
            })
          } catch (e: any) {
            errors.push(`Error updating meeting with stockId ${row.magnaId}: ${e.message}`)
          }
        } else {
          try {
            await req.payload.create({
              collection: 'meetings',
              data: row,
            })
          } catch (e: any) {
            errors.push(`Error creating meeting with stockId ${row.magnaId}: ${e.message}`)
          }
        }
      } catch (error) {
        errors.push(`Error processing row ${i}: ${JSON.stringify(row)} - ${error}`)
      }
    }
    req.payload.logger.info(
      `Successfully processed ${rows.length} rows from CSV file: ${file.name}`,
    )
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
    if (errors.length > 0) {
      console.error(`\nFinished with ${errors.length} errors:`)
      errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }
    return errors
  }
}
