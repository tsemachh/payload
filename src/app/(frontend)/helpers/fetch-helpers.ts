import { handleApiError, notifyError } from './error-handler'
import { logApiCall } from '../lib/api-logger'

interface FetchOptions extends RequestInit {
  notifyOnError?: boolean
  errorMessage?: string
  expectFile?: boolean
  downloadFileName?: string
}

export async function fetchWithErrorHandling<T = any>(
  url: string,
  options?: FetchOptions,
): Promise<T | Blob> {
  const {
    notifyOnError = true,
    errorMessage = 'שגיאה בביצוע הפעולה',
    expectFile = false,
    downloadFileName,
    ...fetchOptions
  } = options || {}

  const startTime = Date.now()
  const method = fetchOptions.method || 'GET'

  try {
    const response = await fetch(url, fetchOptions)

    // Log successful API call
    logApiCall(method, url, startTime, response, undefined, fetchOptions.headers as any)

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { status: response.status, statusText: response.statusText }
      }

      const error = {
        ...errorData,
        status: response.status,
        statusText: response.statusText,
      }

      // Log API error
      logApiCall(method, url, startTime, response, error, fetchOptions.headers as any)

      throw error
    }

    // בדיקה אם זה קובץ או אם ציינו במפורש שאנחנו מצפים לקובץ
    const contentType = response.headers.get('Content-Type')
    const isFile =
      expectFile ||
      contentType?.includes('application/pdf') ||
      contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType?.includes('application/octet-stream') ||
      contentType?.includes('application/download')

    if (isFile) {
      const blob = await response.blob()

      if (downloadFileName) {
        downloadBlob(blob, downloadFileName, response)
      }

      return blob as T
    }

    return await response.json() // Default to JSON
  } catch (error) {
    // Log API error for network/other errors
    logApiCall(method, url, startTime, undefined, error, fetchOptions.headers as any)

    const errorDetails = handleApiError(error, errorMessage)

    // Check if this is an authentication error (401 Unauthorized or 403 Forbidden)
    const errorStatus = (error as any)?.status
    const isAuthError = errorStatus === 401 || errorStatus === 403

    if (isAuthError && typeof window !== 'undefined') {
      if ((globalThis as any).__setAuthUser) {
        ;(globalThis as any).__setAuthUser(null)
      }

      const isLoginEndpoint = url.includes('/api/users/login') || url.includes('/api/users/me')
      const isLoginPage = window.location.pathname.includes('/auth/signin')

      if (!isLoginEndpoint && !isLoginPage) {
        const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/auth/signin?callbackUrl=${callbackUrl}`
      }

      throw errorDetails
    }

    if (notifyOnError) {
      notifyError(errorDetails)
    }

    throw errorDetails
  }
}

function downloadBlob(blob: Blob, defaultFileName: string, response: Response) {
  let fileName = defaultFileName
  const contentDisposition = response.headers.get('Content-Disposition')

  if (contentDisposition) {
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]*)/)
    if (fileNameMatch && fileNameMatch[1]) {
      fileName = decodeURIComponent(fileNameMatch[1])
    } else {
      const fallbackMatch = contentDisposition.match(/filename="([^"]*)"/)
      if (fallbackMatch && fallbackMatch[1]) {
        fileName = decodeURIComponent(fallbackMatch[1])
      }
    }
  }
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)
}

// Specialized versions for common HTTP methods
export const getWithErrorHandling = <T = any>(url: string, options?: FetchOptions) =>
  fetchWithErrorHandling<T>(url, { method: 'GET', ...options })

export const postWithErrorHandling = <T = any>(url: string, data: any, options?: FetchOptions) =>
  fetchWithErrorHandling<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options,
  })

export const downloadFileWithErrorHandling = async (
  url: string,
  fileName: string,
  options?: Omit<FetchOptions, 'expectFile' | 'downloadFileName'>,
) => {
  return getWithErrorHandling(url, {
    ...options,
    expectFile: true,
    downloadFileName: fileName,
  })
}
