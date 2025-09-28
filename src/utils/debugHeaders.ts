import type { PayloadRequest } from 'payload'

export function debugHeaders(req: PayloadRequest | any): { [key: string]: any } {
  const headers: any = req?.headers
  const result: { [key: string]: any } = {
    rawHeaders: {},
    relevantHeaders: {}
  }

  // Collect all headers
  if (headers) {
    if (typeof headers.get === 'function') {
      // Payload v3 style Headers object
      const headerKeys = [
        'x-forwarded-for', 'X-Forwarded-For',
        'x-real-ip', 'X-Real-IP',
        'forwarded', 'Forwarded',
        'x-client-ip', 'X-Client-IP',
        'cf-connecting-ip', 'CF-Connecting-IP',
        'true-client-ip', 'True-Client-IP'
      ]

      headerKeys.forEach(key => {
        const value = headers.get(key)
        if (value) result.relevantHeaders[key] = value
      })

      // Try to get all headers if possible
      try {
        for (const [key, value] of headers.entries()) {
          result.rawHeaders[key] = value
        }
      } catch (e) {
        result.rawHeaders._error = 'Could not enumerate headers'
      }
    } else {
      // Express style headers object
      result.rawHeaders = { ...headers }

      const relevantKeys = [
        'x-forwarded-for', 'X-Forwarded-For',
        'x-real-ip', 'X-Real-IP',
        'forwarded', 'Forwarded',
        'x-client-ip', 'X-Client-IP',
        'cf-connecting-ip', 'CF-Connecting-IP',
        'true-client-ip', 'True-Client-IP'
      ]

      relevantKeys.forEach(key => {
        if (headers[key]) {
          result.relevantHeaders[key] = headers[key]
        }
      })
    }
  }

  // Also check req.ip and connection info
  const req_any = req as any
  result.expressIP = req_any.ip
  result.remoteAddress = req_any.connection?.remoteAddress || req_any.socket?.remoteAddress

  return result
}