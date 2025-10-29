export interface ErrorDetails {
  message: string
  code?: string
  details?: any
}

export const handleApiError = (
  error: any,
  fallbackMessage: string,
  logDetails = true,
): ErrorDetails => {
  // Extract error message
  const errorMessage =
    error?.message || error?.error || (typeof error === 'string' ? error : fallbackMessage)

  // Log detailed error information to console
  if (logDetails) {
    console.error('API Error:', {
      message: errorMessage,
      originalError: error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      // Add any additional context that might be helpful
      url: typeof window !== 'undefined' ? window.location.href : null,
    })
  }

  // Return structured error details
  return {
    message: errorMessage,
    code: error?.code || error?.status,
    details: error,
  }
}

// Global error event system
const ERROR_DIALOG_EVENT = 'show-error-dialog'

// Function to show error dialog using custom event
export const notifyError = (errorDetails: ErrorDetails, showDetails = false) => {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('notifyError called on server side')
    return
  }

  // Dispatch custom event to show error dialog
  const event = new CustomEvent(ERROR_DIALOG_EVENT, {
    detail: { errorDetails, showDetails },
  })

  window.dispatchEvent(event)
}

// Hook to listen for error events (to be used in ErrorDialogProvider)
export const useErrorEventListener = (
  callback: (errorDetails: ErrorDetails, showDetails: boolean) => void,
) => {
  if (typeof window === 'undefined') return

  const handleErrorEvent = (event: CustomEvent) => {
    const { errorDetails, showDetails } = event.detail
    callback(errorDetails, showDetails)
  }

  window.addEventListener(ERROR_DIALOG_EVENT, handleErrorEvent as EventListener)

  // Return cleanup function
  return () => {
    window.removeEventListener(ERROR_DIALOG_EVENT, handleErrorEvent as EventListener)
  }
}

// Combined function for common use case
export const handleAndNotifyError = (error: any, fallbackMessage: string, showDetails = false) => {
  const errorDetails = handleApiError(error, fallbackMessage)
  notifyError(errorDetails, showDetails)
  return errorDetails
}

export const isUserFacingError = (error: any) => {
  const status = error?.details?.status || error?.response?.status
  const message = error?.message || 'Unknown error'

  const userErrors = [400, 401, 403, 404, 428]

  if (userErrors.includes(status)) {
    console.warn(`User error (${status}): ${message}`)
    return true
  }
  return false
}
