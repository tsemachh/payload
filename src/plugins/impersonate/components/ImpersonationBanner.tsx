'use client'

import React from 'react'
import { useImpersonation } from './ImpersonationProvider'
import { getLabels } from '../labels'

interface ImpersonationBannerProps {
  position?: 'top' | 'bottom'
  style?: React.CSSProperties
  className?: string
  locale?: 'en' | 'he'
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  position = 'top',
  style = {},
  className = '',
  locale = 'en',
}) => {
  const { isImpersonating, currentUser, originalUser, exitImpersonation } = useImpersonation()

  if (!isImpersonating) {
    return null
  }

  // Get centralized labels
  const currentLabels = getLabels(locale)

  const defaultStyle: React.CSSProperties = {
    position: 'fixed',
    [position]: 0,
    left: '20%',
    backgroundColor: '#ff6b35',
    color: 'white',
    padding: '12px 16px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: 9999,
    boxShadow: position === 'top' ? '0 2px 4px rgba(0,0,0,0.1)' : '0 -2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    direction: locale === 'he' ? 'rtl' : 'ltr',
    width: '550px',
    ...style,
  }

  return (
    <div style={defaultStyle} className={className}>
      <span>
        🎭 {currentLabels.impersonating as string}{' '}
        <strong>{currentUser?.email || currentUser?.id}</strong>
        {originalUser && (
          <span style={{ opacity: 0.9, marginLeft: '8px' }}>
            ({currentLabels.original as string}: {originalUser.email || originalUser.id})
          </span>
        )}
      </span>
      <button
        onClick={exitImpersonation}
        style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
        }}
      >
        {currentLabels.exitImpersonation as string}
      </button>
    </div>
  )
}
