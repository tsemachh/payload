'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { ErrorDialog } from '../components/error-dialog'
import { ErrorDetails, useErrorEventListener } from '../helpers/error-handler'

interface ErrorDialogContextType {
  showError: (error: ErrorDetails, showDetails?: boolean) => void
  hideError: () => void
  isVisible: boolean
}

const ErrorDialogContext = createContext<ErrorDialogContextType | undefined>(undefined)

export function useErrorDialog() {
  const context = useContext(ErrorDialogContext)
  if (context === undefined) {
    throw new Error('useErrorDialog must be used within an ErrorDialogProvider')
  }
  return context
}

interface ErrorDialogProviderProps {
  children: ReactNode
}

export function ErrorDialogProvider({ children }: ErrorDialogProviderProps) {
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const showError = (errorDetails: ErrorDetails, showDetailedInfo: boolean = false) => {
    setError(errorDetails)
    setShowDetails(showDetailedInfo)
    setIsVisible(true)
  }

  const hideError = () => {
    setIsVisible(false)
    // Clear error after animation completes
    setTimeout(() => {
      setError(null)
      setShowDetails(false)
    }, 200)
  }

  // Listen for global error events
  useEffect(() => {
    const cleanup = useErrorEventListener((errorDetails, showDetailedInfo) => {
      showError(errorDetails, showDetailedInfo)
    })
    
    return cleanup
  }, [])

  const value: ErrorDialogContextType = {
    showError,
    hideError,
    isVisible
  }

  return (
    <ErrorDialogContext.Provider value={value}>
      {children}
      <ErrorDialog
        isOpen={isVisible}
        onClose={hideError}
        error={error}
        showDetails={showDetails}
      />
    </ErrorDialogContext.Provider>
  )
}