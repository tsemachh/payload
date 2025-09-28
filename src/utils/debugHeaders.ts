import type { PayloadRequest } from 'payload'

export function debugHeaders(req: PayloadRequest | any): { [key: string]: any } {
  const headers: any = req?.headers
  const result: { [key: string]: any } = {
    relevantHeaders: {}
  }

  // Only check specific headers we care about
  const headerKeys = [
    'x-forwarded-for', 'X-Forwarded-For',
    'x-real-ip', 'X-Real-IP',
    'forwarded', 'Forwarded',
    'x-client-ip', 'X-Client-IP',
    'cf-connecting-ip', 'CF-Connecting-IP',
    'true-client-ip', 'True-Client-IP'
  ]

  if (headers) {
    try {
      if (typeof headers.get === 'function') {
        // Payload v3 style Headers object
        headerKeys.forEach(key => {
          try {
            const value = headers.get(key)
            if (value) result.relevantHeaders[key] = value
          } catch (e) {
            // Skip problematic headers
          }
        })
      } else {
        // Express style headers object
        headerKeys.forEach(key => {
          if (headers[key]) {
            result.relevantHeaders[key] = headers[key]
          }
        })
      }
    } catch (e) {
      result.error = 'Could not read headers'
    }
  }

  // Also check req.ip and connection info
  try {
    const req_any = req as any
    result.expressIP = req_any.ip
    result.remoteAddress = req_any.connection?.remoteAddress || req_any.socket?.remoteAddress
  } catch (e) {
    // Skip if not available
  }

  return result
}