import useSWR, { SWRConfiguration } from 'swr'
import { handleApiError, notifyError } from './error-handler'

export function useSWRWithErrorHandling<Data = any, Error = any>(
  key: string | null,
  fetcher: (url: string) => Promise<Data>,
  options?: SWRConfiguration & {
    notifyOnError?: boolean
    errorMessage?: string
  },
) {
  const {
    notifyOnError = true,
    errorMessage = 'שגיאה בטעינת נתונים',
    ...swrOptions
  } = options || {}

  return useSWR<Data, Error>(key, fetcher, {
    ...swrOptions,
    onError: (error) => {
      const errorDetails = handleApiError(error, errorMessage)

      if (notifyOnError) {
        notifyError(errorDetails)
      }

      if (swrOptions?.onError) {
        swrOptions.onError(error, key || '', {} as any)
      }
    },
  })
}