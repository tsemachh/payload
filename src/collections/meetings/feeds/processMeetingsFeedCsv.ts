import { PayloadRequest } from 'payload'
import csvToJson from 'convert-csv-to-json'
import iconv from 'iconv-lite'
import { getSequenceStockId } from '@/utils/utils'
import { MeetingType } from '@/payload-types'
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
    //const csvData = file.data.toString('utf8')
    // Parse the CSV file using csvToJson as specified in the issue description
    const results = csvToJson.fieldDelimiter('').csvStringToJson(csvData)
    results.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (typeof item[key] === 'string') {
          item[key] = item[key].trim()
        }
      })
    })
    // const valueDate = parseDate(results[0].security_id)
    // console.log('valueDate:', valueDate)
    // Convert JSON data to ImportStock format
    results.shift()
    results.shift()
    results.pop()
    const key = Object.keys(results[0])[0]
    const headers = results[0][key].split('\t')
    const dataObjects = results.slice(1).map((row) => {
      const values = row[key].split('\t')
      const obj: { [key: string]: string } = {}
      headers.forEach((field: any, i: any) => {
        obj[field] = values[i]?.trim() || ''
      })
      return obj
    })

    const rows: any[] = dataObjects.map((data) => ({
      type: getMeetingType(data.MeetingType || '') as MeetingType,
      magnaId: data.ProofId || '',
      stock: data.stockID || '',
      meetingDate: data.mdate || '',
      holdingsLimit: data.sdate || '',
      location: data.location || '',
    }))
    req.payload.logger.info(`Processing ${rows.length} rows from CSV file: ${file.name}`)

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        console.log('Row:', row)
        const stockId = await getSequenceStockId(req.payload, row.stock)
        if (stockId === null) {
          console.log("Stockid can't be found:", row.stockID)
        }
        row.stock = stockId
        const meetingDate = new Date(row.meetingDate)
        row.meetingDate = meetingDate
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
