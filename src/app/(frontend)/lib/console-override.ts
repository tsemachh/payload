import { Logtail } from '@logtail/browser'

interface OriginalConsole {
  log: typeof console.log
  info: typeof console.info
  warn: typeof console.warn
  error: typeof console.error
  debug: typeof console.debug
}

let originalConsole: OriginalConsole | null = null
let isOverridden = false

export const setupConsoleOverride = (logtail: Logtail, getLogContext?: () => object) => {
  if (typeof window === 'undefined') {
    return
  }

  // If already overridden, restore first before setting up again
  if (isOverridden) {
    restoreConsole()
  }

  // Store original console methods
  originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  }

  // Override console methods
  console.log = (...args: any[]) => {
    originalConsole!.log(...args)
    logtail.info(formatConsoleMessage(args), { 
      source: 'console.log',
      ...(getLogContext ? getLogContext() : { timestamp: new Date().toISOString() })
    })
  }

  console.info = (...args: any[]) => {
    originalConsole!.info(...args)
    logtail.info(formatConsoleMessage(args), { 
      source: 'console.info',
      ...(getLogContext ? getLogContext() : { timestamp: new Date().toISOString() })
    })
  }

  console.warn = (...args: any[]) => {
    originalConsole!.warn(...args)
    logtail.warn(formatConsoleMessage(args), { 
      source: 'console.warn',
      ...(getLogContext ? getLogContext() : { timestamp: new Date().toISOString() })
    })
  }

  console.error = (...args: any[]) => {
    originalConsole!.error(...args)
    logtail.error(formatConsoleMessage(args), { 
      source: 'console.error',
      ...(getLogContext ? getLogContext() : { timestamp: new Date().toISOString() })
    })
  }

  console.debug = (...args: any[]) => {
    originalConsole!.debug(...args)
    logtail.debug(formatConsoleMessage(args), { 
      source: 'console.debug',
      ...(getLogContext ? getLogContext() : { timestamp: new Date().toISOString() })
    })
  }

  isOverridden = true
}

export const restoreConsole = () => {
  if (!isOverridden || !originalConsole || typeof window === 'undefined') {
    return
  }

  console.log = originalConsole.log
  console.info = originalConsole.info
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.debug = originalConsole.debug

  isOverridden = false
}

const formatConsoleMessage = (args: any[]): string => {
  return args
    .map(arg => {
      if (typeof arg === 'string') {
        return arg
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return '[Object]'
        }
      } else {
        return String(arg)
      }
    })
    .join(' ')
}