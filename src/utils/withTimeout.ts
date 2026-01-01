/**
 * Utility to wrap a promise with a timeout.
 * If the promise doesn't resolve or reject within the specified time,
 * it rejects with a timeout error.
 *
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Custom error message
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out',
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    return result as T
  } finally {
    clearTimeout(timeoutHandle!)
  }
}
