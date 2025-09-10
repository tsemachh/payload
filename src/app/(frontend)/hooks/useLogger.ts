'use client'

import { useLogtail } from '../providers/logtail-provider'

export const useLogger = () => {
  const { logtail, isReady, getLogContext } = useLogtail()

  const log = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => {
    if (isReady && logtail) {
      logtail[level](message, {
        source: 'useLogger',
        ...getLogContext(),
        ...data
      })
    } else {
      console[level](message, data)
    }
  }

  return {
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
    debug: (message: string, data?: any) => log('debug', message, data),
    isReady
  }
}