import type { TaskHandler } from 'payload'
import { Payload } from 'payload'
import { updateCompaniesMeetingsOnHoldingChange } from '@/collections/holdings/hooks/updateCompaniesMeetings'
import { sanitizeRequest } from './utils'

export const processHoldingsChangeHandler: TaskHandler<'processHoldingsChange'> = async ({
  input,
  req,
}) => {
  try {
    console.log('processHoldingsChangeHandler started')
    await sanitizeRequest(req)

    const holdingId = input?.holdingId
    if (!holdingId) {
      req.payload.logger.error('No holding ID provided for processHoldingsChange task')
      return {
        output: { success: false, error: 'No holding ID provided' },
      }
    }

    // Fetch the holding document
    const holding = await req.payload.findByID({
      collection: 'holdings',
      id: holdingId,
    })

    if (!holding) {
      req.payload.logger.error(`Holding with ID ${holdingId} not found`)
      return {
        output: { success: false, error: `Holding with ID ${holdingId} not found` },
      }
    }

    // Process the holding
    await updateCompaniesMeetingsOnHoldingChange(req, holding)

    req.payload.logger.info(`Processed holdings change for holding ${holdingId}`)
    return {
      output: { success: true, holdingId },
    }
  } catch (error) {
    req.payload.logger.error(`Error in processHoldingsChange task: ${JSON.stringify(error)}`)
    throw error
  }
}

/**
 * Schedule a job to process holdings change
 * @param payload Payload instance
 * @param holdingId ID of the holding to process
 */
export const scheduleProcessHoldingsChangeTask = async (
  payload: Payload,
  holdingId: string,
): Promise<void> => {
  await payload.jobs.queue({
    task: 'processHoldingsChange',
    queue: 'holdings',
    input: { holdingId },
  })
}
