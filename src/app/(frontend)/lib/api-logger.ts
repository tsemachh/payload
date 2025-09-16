interface ApiLogData {
  method: string
  url: string
  apiName: string
  status?: number
  duration: number
  contentType?: string
  contentLength?: number
  userAgent?: string
  referrer?: string
  type: 'api_request' | 'api_response' | 'api_error'
  error?: string
  apiCallTime: string
}

// Get content type safely
const getContentType = (headers: Headers | Record<string, string> | undefined): string => {
  if (!headers) return 'unknown'
  
  if (headers instanceof Headers) {
    return headers.get('content-type') || 'unknown'
  }
  
  // Handle plain object headers
  const contentType = Object.entries(headers).find(([key]) => 
    key.toLowerCase() === 'content-type'
  )?.[1]
  
  return contentType || 'unknown'
}

// Get content length safely
const getContentLength = (headers: Headers | Record<string, string> | undefined): number => {
  if (!headers) return 0
  
  if (headers instanceof Headers) {
    return parseInt(headers.get('content-length') || '0', 10)
  }
  
  // Handle plain object headers
  const contentLength = Object.entries(headers).find(([key]) => 
    key.toLowerCase() === 'content-length'
  )?.[1]
  
  return parseInt(contentLength || '0', 10)
}

// Determine if request involves file operations
const isFileOperation = (url: string, contentType: string): boolean => {
  const fileKeywords = ['upload', 'download', 'file', 'pdf', 'export', 'import']
  const hasFileKeyword = fileKeywords.some(keyword => url.toLowerCase().includes(keyword))
  const isFileContentType = contentType.includes('multipart/form-data') || 
                           contentType.includes('application/octet-stream') ||
                           contentType.includes('application/pdf') ||
                           contentType.includes('image/') ||
                           contentType.includes('video/') ||
                           contentType.includes('audio/')
  
  return hasFileKeyword || isFileContentType
}

// Extract API name from URL for easier filtering and analysis
const getApiName = (url: string): string => {
  try {
    // Remove query parameters and fragments
    const cleanUrl = url.split('?')[0].split('#')[0]
    
    // Remove domain if present
    const pathOnly = cleanUrl.includes('://') 
      ? new URL(cleanUrl).pathname 
      : cleanUrl
    
    // Extract meaningful API name
    const parts = pathOnly.split('/').filter(Boolean)
    
    if (parts.length === 0) return 'root'
    
    // For /api/something, return "something"
    if (parts[0] === 'api' && parts.length > 1) {
      return parts.slice(1).join('/')
    }
    
    // For /payload/something, return "payload/something"  
    if (parts[0] === 'payload') {
      return parts.join('/')
    }
    
    // For other paths, return the full path without leading slash
    return parts.join('/')
  } catch {
    // Fallback: return the original URL if parsing fails
    return url
  }
}

export const logApiCall = (
  method: string,
  url: string,
  startTime: number,
  response?: Response,
  error?: any,
  requestHeaders?: Headers | Record<string, string>
) => {
  const duration = Date.now() - startTime
  const contentType = response ? getContentType(response.headers) : getContentType(requestHeaders)
  const contentLength = response ? getContentLength(response.headers) : 0
  
  const baseLogData: ApiLogData = {
    method: method.toUpperCase(),
    url,
    apiName: getApiName(url),
    duration,
    contentType,
    contentLength,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
    referrer: typeof window !== 'undefined' ? document.referrer : 'unknown',
    type: error ? 'api_error' : (response ? 'api_response' : 'api_request'),
    apiCallTime: new Date(startTime).toISOString()
  }

  if (response) {
    baseLogData.status = response.status
  }

  if (error) {
    baseLogData.error = error.message || String(error)
  }

  // Enhanced logging for file operations
  const isFile = isFileOperation(url, contentType)
  if (isFile) {
    baseLogData.contentType = `${contentType} (file operation)`
  }

  // Console logging with clean URL (without massive query params)
  const cleanUrlForDisplay = url.length > 100 ? url.split('?')[0] + (url.includes('?') ? '?...' : '') : url
  const statusEmoji = error ? '❌' : (response?.ok ? '✅' : '⚠️')
  const fileIndicator = isFile ? '📁 ' : ''
  console.log(
    `${statusEmoji} ${fileIndicator}API ${method.toUpperCase()} ${cleanUrlForDisplay} - ${response?.status || 'ERROR'} (${duration}ms)`
  )

  // Detailed console log for errors or slow requests
  if (error || duration > 3000 || !response?.ok) {
    console.log('API Call Details:', {
      method: baseLogData.method,
      url: baseLogData.url,
      status: baseLogData.status,
      duration: `${baseLogData.duration}ms`,
      contentType: baseLogData.contentType,
      error: baseLogData.error
    })
  }

  // Log to Logtail if logger is available
  if (logtailLogger) {
    const logLevel = error ? 'error' : (response?.ok ? 'info' : 'warn')
    const cleanUrlForMessage = url.length > 100 ? url.split('?')[0] + (url.includes('?') ? '?...' : '') : url
    const message = error 
      ? `API ${method.toUpperCase()} ${cleanUrlForMessage} failed`
      : `API ${method.toUpperCase()} ${cleanUrlForMessage} completed`

    logtailLogger[logLevel](message, baseLogData)
  }

  // Return the log data
  return baseLogData
}

// For non-hook usage, we'll add Logtail logging directly
let logtailLogger: any = null

export const setLogtailLogger = (logger: any) => {
  logtailLogger = logger
}