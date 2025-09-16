import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { processHoldingsFeedCsv } from '../processHoldingsFeedCsv'
import { HoldingsFeed } from '@/payload-types'
import { FeedValidationResult } from '@/collections/holdings/feeds/FeedTypes'
import { getBufferFromStream } from '@/utils/dataUtils'
import { performance } from 'perf_hooks'
import { getIdOfRelationField } from '@/utils/utils'

const uploadHoldingsCsvEndPoint = async (req: PayloadRequest) => {
  const startTime = performance.now()
  try {
    await addDataAndFileToRequest(req)
    req.payload.logger.info('Starting holdings upload process')
    if (!req.user) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get parameters from the request
    const { valueDate, companies, validateOnly } = req.query
    const isValidationOnly = validateOnly === 'true'
    if (!valueDate) {
      return Response.json({ error: 'Value date is required' }, { status: 400 })
    }

    // Parse companies parameter
    let selectedCompanies: string[] = []
    if (companies) {
      try {
        selectedCompanies = JSON.parse(companies as string)
      } catch (e) {
        // If parsing fails, try treating it as a comma-separated string
        selectedCompanies = (companies as string).split(',')
      }
    }
    const userFundIds = req.user?.funds?.map(getIdOfRelationField) || []
    //Filter only companyIds of the user
    selectedCompanies = selectedCompanies.filter((companyId) => userFundIds.includes(companyId))
    // Check if user has write permission for all selected companies
    if (!isValidationOnly) {
      // Only check permissions for actual uploads, not validations
      const hasPermission = true

      // selectedCompanies.every(companyId =>
      //   hasCompanyPermission(req.user, companyId, 'write')
      // )
      //TODO check for parent fund company and write permissjons
      if (!hasPermission) {
        return Response.json(
          { error: 'Permission denied for one or more companies' },
          { status: 403 },
        )
      }
    }

    // Get the ReadableStream from the request body
    const stream = req.body
    if (!stream) {
      return Response.json({ error: 'No stream provided' }, { status: 400 })
    }

    const streamStartTime = performance.now()
    const buffer = await getBufferFromStream(stream)
    const streamEndTime = performance.now()
    req.payload.logger.info(
      `Stream to buffer conversion completed in ${streamEndTime - streamStartTime}ms`,
    )

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

    // selectedCompanies is already parsed above

    // Create a new HoldingsFeed document
    const holdingsFeed = {
      valueDate,
      comments: '',
      selectedCompanies: selectedCompanies.length > 0 ? selectedCompanies : undefined,
    } as Partial<HoldingsFeed>
    //Make sure selectedCompanies are IDs
    req.file = file

    // Process the holdings feed synchronously
    req.payload.logger.info(`Starting holdings feed processing for ${file.size} bytes`)
    const processingStartTime = performance.now()
    const feedResult: FeedValidationResult | undefined = await processHoldingsFeedCsv(
      req,
      holdingsFeed,
      isValidationOnly,
    )
    const processingEndTime = performance.now()
    req.payload.logger.info(
      `Holdings feed processing completed in ${processingEndTime - processingStartTime}ms`,
    )
    if (feedResult != null) {
      const endTime = performance.now()
      req.payload.logger.info(`Total holdings upload process completed in ${endTime - startTime}ms`)
      return Response.json({
        feedResult: {
          ...feedResult,
          isDuplicate: false,
        },
      })
    } else {
      req.payload.logger.error('Error processing holdings file')
      return Response.json({ error: 'Error processing holdings file' }, { status: 500 })
    }
  } catch (error) {
    const endTime = performance.now()
    req.payload.logger.error(
      `Error uploading holdings file: ${error}. Process took ${endTime - startTime}ms`,
    )
    console.error('Error uploading holdings file:', error)
    return Response.json({ error: 'Error uploading holdings file' }, { status: 500 })
  }
}

export default uploadHoldingsCsvEndPoint
