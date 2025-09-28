import type { PayloadRequest } from 'payload'

export function logAllHeaders(req: PayloadRequest | any): void {
  const headers: any = req?.headers

  req.payload.logger.info('=== HEADER DEBUG START ===')

  // Check if headers exist
  req.payload.logger.info(`Headers object exists: ${!!headers}`)
  req.payload.logger.info(`Headers has get method: ${typeof headers?.get === 'function'}`)

  // Try to get specific headers we care about
  const headerKeys = [
    'x-forwarded-for',
    'x-real-ip',
    'forwarded',
    'x-client-ip',
    'cf-connecting-ip',
    'true-client-ip',
  ]

  headerKeys.forEach((key) => {
    try {
      let value = null
      if (headers?.get) {
        value = headers.get(key)
      } else if (headers) {
        value = headers[key]
      }
      req.payload.logger.info(`Header ${key}: ${value || 'NOT_FOUND'}`)
    } catch (e: any) {
      req.payload.logger.info(`Header ${key}: ERROR ${e?.message}`)
    }
  })

  // Check req properties
  const req_any = req as any
  req.payload.logger.info(`req.ip: ${req_any.ip || 'NOT_FOUND'}`)
  req.payload.logger.info(`req.connection.remoteAddress: ${req_any.connection?.remoteAddress || 'NOT_FOUND'}`)
  req.payload.logger.info(`req.socket.remoteAddress: ${req_any.socket?.remoteAddress || 'NOT_FOUND'}`)

  req.payload.logger.info('=== HEADER DEBUG END ===')
}
