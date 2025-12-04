import { MigrateUpArgs } from '@payloadcms/db-mongodb'

/**
 * Returns the actor string from a Payload request, or 'system' as fallback.
 */
export function getActor(req?: MigrateUpArgs['req']): string {
  const anyReq = req as any
  return (
    anyReq?.user?.email ||
    anyReq?.user?.id ||
    anyReq?.user?.username ||
    anyReq?.user?.name ||
    'system'
  )
}

// Module-level guard to avoid double wrapping on nested calls
let wrapDepth = 0
let savedLog: typeof console.log | null = null
let savedError: typeof console.error | null = null

/**
 * Apply a scoped console prefix wrapper that adds an ISO timestamp and actor.
 * Returns a restore function that MUST be called (typically in `finally`).
 *
 * - If already wrapped (nested), it will not wrap again; it just increases depth
 *   and the returned restore will only decrease depth.
 * - When depth returns to zero, original console methods are restored.
 */
export function applyScopedConsolePrefix(input?: MigrateUpArgs['req'] | string): () => void {
  const actor = typeof input === 'string' ? input : getActor(input as MigrateUpArgs['req'])

  if (wrapDepth === 0) {
    savedLog = console.log
    savedError = console.error

    const prefix = () => `[${new Date().toISOString()}] [actor:${actor}]`

    console.log = (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - savedLog is set above when wrapping
      savedLog!(prefix(), ...args)
    }
    console.error = (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - savedError is set above when wrapping
      savedError!(prefix(), ...args)
    }
  }

  wrapDepth++

  return () => {
    wrapDepth--
    if (wrapDepth <= 0) {
      // Restore and reset
      if (savedLog) console.log = savedLog
      if (savedError) console.error = savedError
      savedLog = null
      savedError = null
      wrapDepth = 0
    }
  }
}

/**
 * Helper to run an async function with the migration logging applied.
 * Ensures proper restore even if an error is thrown.
 */
export async function withMigrationLogging<T>(
  req: MigrateUpArgs['req'] | string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const restore = applyScopedConsolePrefix(req)
  try {
    return await fn()
  } finally {
    restore()
  }
}
