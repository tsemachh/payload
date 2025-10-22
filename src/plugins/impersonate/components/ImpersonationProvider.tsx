'use client'

import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'

interface ImpersonationData {
  isImpersonating: boolean
  currentUser?: {
    email?: string
    id: string | number
  }
  originalUser?: {
    email?: string
    id: string | number
  }
}

interface ImpersonationContextType extends ImpersonationData {
  exitImpersonation: () => void
  refreshStatus: () => Promise<void>
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null)

interface ImpersonationProviderProps {
  children: ReactNode
  checkInterval?: number // in milliseconds, default 300000 (5 minutes)
  authCollection?: string // collection slug for auth, default 'users'
}

export const ImpersonationProvider: React.FC<ImpersonationProviderProps> = ({
  children,
  checkInterval = 300000,
  authCollection = 'users',
}) => {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData>({
    isImpersonating: false,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkImpersonation = async () => {
    try {
      const response = await fetch(`/api/${authCollection}/impersonate/status`)
      if (response.ok) {
        const data = await response.json()
        setImpersonationData(data)
      }
    } catch (error) {
      console.warn('Failed to check impersonation status:', error)
    }
  }

  const exitImpersonation = () => {
    if (impersonationData.originalUser) {
      window.location.href = `/api/${authCollection}/unImpersonate/${impersonationData.originalUser.id}`
    }
  }

  // Initial one-time check on mount or when authCollection changes
  useEffect(() => {
    checkImpersonation()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [authCollection])

  // Poll only when currently impersonating
  useEffect(() => {
    if (impersonationData.isImpersonating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      intervalRef.current = setInterval(checkImpersonation, checkInterval)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [impersonationData.isImpersonating, checkInterval])

  const contextValue: ImpersonationContextType = {
    ...impersonationData,
    exitImpersonation,
    refreshStatus: checkImpersonation,
  }

  return (
    <ImpersonationContext.Provider value={contextValue}>{children}</ImpersonationContext.Provider>
  )
}

export const useImpersonation = (): ImpersonationContextType => {
  const context = useContext(ImpersonationContext)
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider')
  }
  return context
}
