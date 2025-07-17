'use client'

import React, { useEffect, useState } from 'react'

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

export const ClientImpersonationBar: React.FC = () => {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData>({
    isImpersonating: false,
  })

  useEffect(() => {
    // Check for impersonation status
    const checkImpersonation = async () => {
      try {
        const response = await fetch('/api/impersonate/status')
        if (response.ok) {
          const data = await response.json()
          setImpersonationData(data)
        }
      } catch (error) {
        console.warn('Failed to check impersonation status:', error)
      }
    }

    checkImpersonation()
  }, [])

  if (!impersonationData.isImpersonating) {
    return null
  }

  const handleExitImpersonation = () => {
    if (impersonationData.originalUser) {
      window.location.href = `/api/users/unImpersonate/${impersonationData.originalUser.id}`
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ff6b35',
        color: 'white',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: 9999,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      🎭 You are impersonating{' '}
      {impersonationData.currentUser?.email || impersonationData.currentUser?.id}
      {impersonationData.originalUser && (
        <>
          {' '}
          (Original: {impersonationData.originalUser.email || impersonationData.originalUser.id})
          <button
            onClick={handleExitImpersonation}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              marginLeft: '12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            Exit Impersonation
          </button>
        </>
      )}
    </div>
  )
}
