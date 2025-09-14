'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { Logtail } from '@logtail/browser'
import { setupConsoleOverride, restoreConsole } from '../lib/console-override'
import { setLogtailLogger } from '../lib/api-logger'
import { useAuth } from '@/providers/auth-provider'

interface LogtailContextType {
  logtail: Logtail | null
  isReady: boolean
  getLogContext: () => object
}

const LogtailContext = createContext<LogtailContextType>({
  logtail: null,
  isReady: false,
  getLogContext: () => ({})
})

export const useLogtail = () => {
  const context = useContext(LogtailContext)
  if (!context) {
    throw new Error('useLogtail must be used within a LogtailProvider')
  }
  return context
}

export const LogtailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logtail, setLogtail] = useState<Logtail | null>(null)
  const [isReady, setIsReady] = useState(false)
  const { user } = useAuth()

  const getLogContext = () => ({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    user: user ? {
      id: user.id,
      email: user.email,
      name: user.name || user.email
    } : null
  })

  useEffect(() => {
    const initializeLogtail = async () => {
      if (logtail) {
        // If logtail is already initialized, just update console override with new context
        setupConsoleOverride(logtail, getLogContext)
        return
      }

      try {
        const response = await fetch('/api/config')
        const config = await response.json()
        
        if (config.logtailToken) {
          const logtailInstance = new Logtail(config.logtailToken, {
            endpoint: 'https://s1214463.eu-nbg-2.betterstackdata.com'
          })
          setLogtail(logtailInstance)
          setIsReady(true)
          
          // Setup console override after Logtail is ready with context
          setupConsoleOverride(logtailInstance, getLogContext)
          
          // Setup API logger with Logtail instance
          setLogtailLogger(logtailInstance)
          
          logtailInstance.info('Logtail initialized successfully with console override and API logging', {
            ...getLogContext(),
            source: 'logtail-provider'
          })
        }
      } catch (error) {
        console.error('Failed to initialize Logtail:', error)
        setIsReady(true)
      }
    }

    initializeLogtail()

    // Cleanup function to restore console on unmount
    return () => {
      restoreConsole()
    }
  }, [user, logtail])

  return (
    <LogtailContext.Provider value={{ logtail, isReady, getLogContext }}>
      {children}
    </LogtailContext.Provider>
  )
}