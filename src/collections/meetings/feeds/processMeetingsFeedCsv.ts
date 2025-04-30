import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
import { getSequenceStockId, getStockByStockId } from '@/utils/utils'
import { parseDateString } from '@/utils/dateUtils'
import { MeetingState, MeetingType } from '@/payload-types'
import { PromisePool } from '@/utils/promisePool'

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
  return await payload.find({
    collection: 'meetings',
    where: {
      magnaId: {
        equals: magnaId,
      },
    },
    limit: 1,
  })
}

const requiredFields = ['type', 'magnaId', 'meetingDate', 'holdingsLimit', 'location', 'stock']
export const processMeetingsFeedCsv = async (req: PayloadRequest, doc: any): Promise<string[]> => {
  const errors: string[] = []
  try {
    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      errors.push('לא נמצא קובץ בבקשה')
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
          proofIdPrev: data.ProofIdPrev || '',
          _status: 'draft',
        }
      } catch (e: any) {
        errors.push(`שגיאה בעיבוד הרשומה: ${JSON.stringify(data)} - ${e.message}`)
      }
    })

    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Check for missing columns in the CSV
    const missingColumns = getMissingColumns(rows, requiredFields)
    if (missingColumns.length > 0) {
      errors.push(`בקובץ csv חסרות עמודות שהן חובה  ${missingColumns.join(', ')} (ריק בכל השורות)`)
      return errors
    }

    // Create a promise pool with 20 concurrent threads
    const stockIds = [...new Set(rows.map((row) => row.stock))]
    const stocks = await req.payload.find({
      collection: 'stocks',
      select: {
        id: true,
        active: true,
        stockId: true,
      },
      where: {
        stockId: {
          in: stockIds,
        },
      },
      limit: 0,
    })
    const promisePool = new PromisePool(20)
    const promises = []

    const stockIdMap = new Map()

    for (const stock of stocks.docs) {
      stockIdMap.set(stock.stockId, {
        id: stock.id,
        active: stock.active,
      })
    }
    // Process each row in parallel using the promise pool
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowIndex = i

      promises.push(
        promisePool.add(async () => {
          try {
            console.log('Row:', row)
            const missingFields = getMissingFieldsInRow(row, requiredFields)

            if (missingFields.length > 0) {
              errors.push(
                `לאסיפה עם האסמכתא ${row.magnaId} חסרים שדות נדרשים: ${missingFields.join(', ')}`,
              )

              return
            }
            const stockData = stockIdMap.get(row.stock)
            if (stockData === null || stockData === undefined) {
              errors.push(
                `לאסיפה עם האסמכתא ${row.magnaId} יש stockId ${row.stock} שלא נמצא ולא ייובא — האסיפה הזו לא תיווצר`,
              )
              return
            }
            if (!stockData?.active) {
              errors.push(
                `לאסיפה עם האסמכתא ${row.magnaId} יש stockId ${row.stock} שאינו פעיל ולא ייובא — האסיפה הזו לא תיווצר`,
              )
              return
            }

            row.stock = stockData

            if (row.proofIdPrev) {
              const prevMeeting = await findMeetingByMagnaId(req.payload, row.proofIdPrev)
              if (prevMeeting && prevMeeting.docs.length > 0) {
                const { ...dataToUpdate } = row
                dataToUpdate.magnaId = row.proofIdPrev
                delete dataToUpdate.proofIdPrev
                const prevMeetingId = prevMeeting.docs[0].id
                try {
                  await req.payload.update({
                    collection: 'meetings',
                    id: prevMeetingId,
                    data: dataToUpdate,
                    context: { ...req.context, from: 'migration' },
                  })
                } catch (e: any) {
                  errors.push(`שגיאה בעידכון הפגישה עם האסמכתא  ${row.proofIdPrev}: ${e.message}`)
                  req.payload.logger.error(
                    `Error updating meeting with ProofIdPrev ${row.proofIdPrev}`,
                  )
                }
              } else {
                errors.push(`לא נמצאה אסיפה עם האסמכתא  ${row.proofIdPrev}, האסיפה לא תתעדכן`)
                req.payload.logger.warn(`No meeting found for ProofIdPrev ${row.proofIdPrev}`)
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
                errors.push(`שגיאה בעידכון האסיפה עם האסמכתא  ${row.magnaId}: ${e.message}`)
              }
            } else {
              try {
                await req.payload.create({
                  collection: 'meetings',
                  data: row,
                  context: { ...req.context, from: 'migration' },
                })
              } catch (e: any) {
                errors.push(`שגיאה בייצור הפגישה עם האסמכתא ${row.magnaId}: ${e.message}`)
              }
            }
          } catch (error) {
            errors.push(`שגיאה בעיבוד הרשומה  ${rowIndex}: ${JSON.stringify(row)} - ${error}`)
          }
        }),
      )
    }

    // Wait for all promises to complete
    await promisePool.waitForAll()
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
    errors.push(`שגיאה בעיבוד קובץ האסיפות: ${JSON.stringify(error)}`)
    if (errors.length > 0) {
      console.error(`\nFinished with ${errors.length} errors:`)
      errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }
    return errors
  }
}
