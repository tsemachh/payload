'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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
  checkInterval?: number // in milliseconds, default 30000 (30 seconds)
  authCollection?: string // collection slug for auth, default 'users'
}

export const ImpersonationProvider: React.FC<ImpersonationProviderProps> = ({
  children,
  checkInterval = 30000,
  authCollection = 'users',
}) => {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData>({
    isImpersonating: false,
  })

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

  useEffect(() => {
    checkImpersonation()

    const interval = setInterval(checkImpersonation, checkInterval)
    return () => clearInterval(interval)
  }, [checkInterval])

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
