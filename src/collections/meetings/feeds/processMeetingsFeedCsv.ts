import { PayloadRequest } from 'payload'
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
    draft: true,
  })
}

const requiredFields = ['type', 'magnaId', 'meetingDate', 'holdingsLimit', 'location', 'stock']
const convertDataToObjects = (jsonData: any) => {
  const keys = Object.keys(jsonData.schema)
  return jsonData.data.map((row: any[]) => {
    const obj: any = {}
    keys.forEach((key, index) => {
      obj[key] = row[index]
    })
    return obj
  })
}

export function convertMagnaToPayloadMeeting(data: any) {
  return {
    type: getMeetingType(data.MeetingType || '') as MeetingType,
    magnaId: data.ProofId || data.proofID || '',
    stock: data.stockID || '',
    meetingDate: data.mdate != '' ? parseDateString(data.mdate) : null,
    holdingsLimit: data.sdate != '' ? parseDateString(data.sdate) : null,
    location: data.location || '',
    state: getMeetingState(data.state || '') as MeetingState,
    proofIdPrev: data.ProofIdPrev || '',
    electronicVotingEnabled: true,
    _status: 'draft',
    createdAt: data.ReportDate != '' ? parseDateString(data.ReportDate) : null,
  }
}

// Inner function to process a single row without promise pool
async function processRowInner(
  row: any,
  rowIndex: number,
  req: PayloadRequest,
  context: MeetingFeedContext,
  stockIdMap: Map<string, any>,
): Promise<void> {
  try {
    const missingFields = getMissingFieldsInRow(row, requiredFields)

    if (missingFields.length > 0) {
      context.errors.push(
        `לאסיפה עם האסמכתא ${row.magnaId} חסרים שדות נדרשים: ${missingFields.join(', ')}`,
      )
      return
    }
    const stockData = stockIdMap.get(String(row.stock))
    if (stockData === null || stockData === undefined) {
      context.errors.push(
        `לאסיפה עם האסמכתא ${row.magnaId} יש stockId ${row.stock} שלא נמצא ולא ייובא — האסיפה הזו לא תיווצר`,
      )
      return
    }
    if (!stockData?.active) {
      context.errors.push(
        `לאסיפה עם האסמכתא ${row.magnaId} יש נייר ערך  ${row.stock} שאינו פעיל ולא ייובא — האסיפה הזו לא תיווצר`,
      )
      return
    }

    row.stock = stockData

    if (row.proofIdPrev) {
      context.countTotalPrev++

      // First check if meeting with the new magnaId already exists
      const existingNewMeeting = await findMeetingByMagnaId(req.payload, row.magnaId)
      if (existingNewMeeting && existingNewMeeting.docs.length > 0) {
        req.payload.logger.info(
          `Meeting with magnaId ${row.magnaId} already exists, skipping proofIdPrev update`,
        )
        return // Exit here - meeting already exists with the target magnaId
      }

      const prevMeeting = await findMeetingByMagnaId(req.payload, row.proofIdPrev)
      if (prevMeeting && prevMeeting.docs.length > 0) {
        const { ...dataToUpdate } = row
        delete dataToUpdate.proofIdPrev
        const prevMeetingId = prevMeeting.docs[0].id
        try {
          await req.payload.update({
            collection: 'meetings',
            id: prevMeetingId,
            data: dataToUpdate,
            draft: true,
            context: { ...req.context, from: 'migration', process: 'processMeetingFeedUpdatePrev' },
            req,
          })
          context.successPrevCount++
          context.processedPrevMeetingIds.push(prevMeetingId)
          return // Exit here - don't create new meeting when updating previous one
        } catch (e: any) {
          context.errors.push(`שגיאה בעידכון הפגישה עם האסמכתא  ${row.proofIdPrev}: ${e.message}`)
          req.payload.logger.error(`Error updating meeting with ProofIdPrev ${row.proofIdPrev}`)
          return // Exit here even if update failed - don't create new meeting
        }
      } else {
        context.errors.push(`לא נמצאה אסיפה עם האסמכתא  ${row.proofIdPrev}, האסיפה לא תתעדכן`)
        req.payload.logger.warn(
          `No meeting found for ProofIdPrev ${row.proofIdPrev} for ${row.magnaId}`,
        )
        return // Exit here - don't create new meeting when ProofIdPrev not found
      }
    } else {
      const existingMeeting = await findMeetingByMagnaId(req.payload, row.magnaId)
      if (existingMeeting?.docs.length > 0) {
        const meetingId = existingMeeting?.docs[0].id

        // Always update existing meetings with new data from the feed
        try {
          await req.payload.update({
            collection: 'meetings',
            id: meetingId,
            data: row,
            draft: true,
            context: { ...req.context, from: 'migration', process: 'processMeetingFeed' },
            req,
          })
          context.successCount++
          context.processedMeetingIds.push(meetingId)
        } catch (e: any) {
          context.errors.push(`שגיאה בעידכון האסיפה עם האסמכתא  ${row.magnaId}: ${e.message}`)
        }
      } else {
        try {
          const newMeeting = await req.payload.create({
            collection: 'meetings',
            data: row,
            context: { ...req.context, from: 'migration', process: 'processMeetingFeed' },
            req,
          })
          context.successCount++
          context.processedMeetingIds.push(newMeeting.id)
        } catch (e: any) {
          context.errors.push(`שגיאה בייצור הפגישה עם האסמכתא ${row.magnaId}: ${e.message}`)
        }
      }
    }
  } catch (error) {
    context.errors.push(`שגיאה בעיבוד הרשומה  ${rowIndex}: ${JSON.stringify(row)} - ${error}`)
  }
}

// Helper function to process a single row with promise pool
async function processRow(
  row: any,
  rowIndex: number,
  req: PayloadRequest,
  context: MeetingFeedContext,
  stockIdMap: Map<string, any>,
  promisePool: PromisePool,
): Promise<void> {
  return promisePool.add(async () => {
    await processRowInner(row, rowIndex, req, context, stockIdMap)
  })
}

export async function processJsonMeetingRows(
  rows: any[],
  req: PayloadRequest,
  context: MeetingFeedContext,
) {
  // Create a promise pool with 20 concurrent threads
  const stockIds = [...new Set(rows.map((row) => String(row.stock)))]
  const stocks = await req.payload.find({
    collection: 'stocks',
    select: {
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
    stockIdMap.set(String(stock.stockId), { id: stock.id, active: stock.active })
  }

  // Divide rows into two sets:
  // Set A: rows without proofIdPrev
  // Set B: rows with proofIdPrev
  const rowsWithoutProofIdPrev = rows.filter((row) => !row.proofIdPrev)
  const rowsWithProofIdPrev = rows.filter((row) => row.proofIdPrev)

  req.payload.logger.info(
    `Divided rows into two sets: ${rowsWithoutProofIdPrev.length} rows without proofIdPrev and ${rowsWithProofIdPrev.length} rows with proofIdPrev`,
  )

  // Process rows without proofIdPrev first
  req.payload.logger.info(`Processing ${rowsWithoutProofIdPrev.length} rows without proofIdPrev`)

  // Process each row in parallel using the promise pool
  for (let i = 0; i < rowsWithoutProofIdPrev.length; i++) {
    const row = rowsWithoutProofIdPrev[i]
    const rowIndex = i

    promises.push(processRow(row, rowIndex, req, context, stockIdMap, promisePool))
  }

  // Wait for all promises from the first set to complete
  await promisePool.waitForAll()

  // Process rows with proofIdPrev after the first set is done
  req.payload.logger.info(`Processing ${rowsWithProofIdPrev.length} rows with proofIdPrev`)

  // Clear promises array for the second set
  promises.length = 0

  // Sort rowsWithProofIdPrev by proofIdPrev in ascending order
  rowsWithProofIdPrev.sort((a, b) => {
    return a.proofIdPrev.localeCompare(b.proofIdPrev)
  })

  req.payload.logger.info(
    `Sorted ${rowsWithProofIdPrev.length} rows with proofIdPrev by proofIdPrev in ascending order`,
  )

  // Process each row synchronously (one at a time)
  req.payload.logger.info(
    `Processing ${rowsWithProofIdPrev.length} rows with proofIdPrev synchronously (without promise pool)`,
  )
  for (let i = 0; i < rowsWithProofIdPrev.length; i++) {
    const row = rowsWithProofIdPrev[i]
    const rowIndex = i + rowsWithoutProofIdPrev.length // Adjust index for error reporting

    // Process the row synchronously without using the promise pool
    await processRowInner(row, rowIndex, req, context, stockIdMap)
  }

  req.payload.logger.info(
    `Finished processing all rows: ${rowsWithoutProofIdPrev.length} without proofIdPrev and ${rowsWithProofIdPrev.length} with proofIdPrev`,
  )
  return context
}
export type MeetingFeedContext = {
  errors: string[] // Adjust to `Error[]` or another type if errors are not strings
  successCount: number
  fileLength: number
  successPrevCount: number
  countTotalPrev: number
  processedMeetingIds: string[] // IDs of meetings that were created or updated (without proofIdPrev)
  processedPrevMeetingIds: string[] // IDs of meetings that were updated via proofIdPrev
}
export const processMeetingsFeedCsv = async (
  req: PayloadRequest,
  doc: any,
): Promise<MeetingFeedContext> => {
  const context: MeetingFeedContext = {
    errors: [],
    successCount: 0,
    fileLength: 0,
    successPrevCount: 0,
    countTotalPrev: 0,
    processedMeetingIds: [],
    processedPrevMeetingIds: [],
  }
  try {
    // The file is at req.file as specified in the issue description

    const file = doc.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      context.errors.push('לא נמצא קובץ בבקשה')
      return context
    }

    // Read the file content
    let jsonData: any[] = []
    const fileContent = file.data.toString('utf8')
    jsonData = JSON.parse(fileContent)
    const rawRows = convertDataToObjects(jsonData)
    const rows: any[] = rawRows.map((data: any) => {
      try {
        return convertMagnaToPayloadMeeting(data)
      } catch (e: any) {
        context.errors.push(`שגיאה בעיבוד הרשומה: ${JSON.stringify(data)} - ${e.message}`)
      }
    })

    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Count only rows without proofIdPrev as potential new meetings
    const rowsWithoutPrev = rows.filter((row) => !row.proofIdPrev)
    context.fileLength = rowsWithoutPrev.length

    req.payload.logger.info(
      `Found ${rowsWithoutPrev.length} potential new meetings (without proofIdPrev) out of ${rows.length} total rows`,
    )

    // Check for missing columns in the CSV
    const missingColumns = getMissingColumns(rows, requiredFields)
    if (missingColumns.length > 0) {
      context.errors.push(
        `בקובץ csv חסרות עמודות שהן חובה  ${missingColumns.join(', ')} (ריק בכל השורות)`,
      )
      return context
    }
    const __ret = await processJsonMeetingRows(rows, req, context)
    context.countTotalPrev = __ret.countTotalPrev
    context.successPrevCount = __ret.successPrevCount
    context.successCount = __ret.successCount
    context.processedMeetingIds = __ret.processedMeetingIds
    context.processedPrevMeetingIds = __ret.processedPrevMeetingIds
    req.payload.logger.info(
      `Successfully processed ${rows.length} rows from CSV file: ${file.name}`,
    )
    if (context.errors.length > 0) {
      console.error(`\nFinished with ${context.errors.length} errors:`)
      context.errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }
    return context
  } catch (error: any) {
    req.payload.logger.error(`Error processing Meetings feed CSV: ${error.message}`)
    context.errors.push(`שגיאה בעיבוד קובץ האסיפות: ${error.message})}`)

    if (context.errors.length > 0) {
      console.error(`/nFinished with ${context.errors.length} errors:`)
      context.errors.forEach((err, idx) => {
        console.error(`${idx + 1}. ${err}`)
      })
    }
    return context
  }
}
