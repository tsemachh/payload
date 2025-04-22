import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
import { getSequenceStockId } from '@/utils/utils'
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
export const processMeetingsFeedCsv = async (req: PayloadRequest, doc: any): Promise<void> => {
  try {
    // The file is at req.file as specified in the issue description
    const file = req.file
    if (!file) {
      req.payload.logger.error(`No file found in request`)
      return
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
          _status: 'draft',
        }
      }catch (e) {
          //TODO Aggeragte Error and report at the end
      }
    })
    debugger

    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        console.log('Row:', row)
        const stockId = await getSequenceStockId(req.payload, row.stock)
        if (stockId === null) {
          console.log("Stockid can't be found:", row.stockID)
          //TODO Aggeragte Error and report at the end
          continue
        }
        row.stock = stockId
        await req.payload.create({
          collection: 'meetings',
          data: row,
        })
      } catch (error) {
        console.error('Error creating meeting:', error)
      }
    }
    req.payload.logger.info(
      `Successfully processed ${rows.length} rows from CSV file: ${file.name}`,
    )
  } catch (error) {
    req.payload.logger.error(`Error processing stock feed CSV: ${JSON.stringify(error)}`)
  }
}
