import { PayloadRequest } from 'payload'
import { processHoldingsFeedCsv } from './processHoldingsFeedCsv'
import { HoldingsFeed } from '@/payload-types'
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes'
import { getBufferFromStream } from '@/utils/dataUtils'

const uploadHoldingsCsvEndPoint = async (req: PayloadRequest) => {
  try {
    if (req === null) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get parameters from the request
    const { valueDate, companies, validateOnly } = req.query
    const isValidationOnly = validateOnly === 'true'
    if (!valueDate) {
      return Response.json({ error: 'Value date is required' }, { status: 400 })
    }



    // Get the ReadableStream from the request body
    const stream = req.body
    if (!stream) {
      return Response.json({ error: 'No stream provided' }, { status: 400 })
    }

    const buffer = await getBufferFromStream(stream)
    // Determine the file extension from the content-type header
    const contentType = req.headers.get('content-type')
    let extension = 'csv'
    let mimetype = 'text/csv'

    if (contentType?.includes('excel') || contentType?.includes('spreadsheetml')) {
      extension = 'xlsx'
      mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    // Create a file object from the buffer
    const file = {
      data: buffer,
      name: `holdings-${valueDate}.${extension}`,
      size: buffer.length,
      mimetype,
    }

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }


    // Optional companies parameter as JSON string of company IDs
    let selectedCompanies: string[] = []
    if (companies) {
      try {
        selectedCompanies = JSON.parse(companies as string)
      } catch (e) {
        // If parsing fails, try treating it as a comma-separated string
        selectedCompanies = (companies as string).split(',')
      }
    }

    // Create a new HoldingsFeed document
    const holdingsFeed = {
      valueDate,
      comments: '',
      selectedCompanies: selectedCompanies.length > 0 ? selectedCompanies : undefined,
    } as Partial<HoldingsFeed>
    //Make sure selectedCompanies are IDs
    req.file = file
    // Process the holdings feed synchronously
    const feedResult: FeedValidationResult | undefined = await processHoldingsFeedCsv(
      req,
      holdingsFeed,
      isValidationOnly,
    )
    if (feedResult != null)
      return Response.json({
        feedResult,
      })
    else return Response.json({ error: 'Error procesing  holdings file' }, { status: 500 })
  } catch (error) {
    console.error('Error uploading holdings file:', error)
    return Response.json({ error: 'Error uploading holdings file' }, { status: 500 })
  }
}

export default uploadHoldingsCsvEndPoint
