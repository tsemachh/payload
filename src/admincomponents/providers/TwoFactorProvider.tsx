'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { AdminTwoFactorSetup } from '@/admincomponents/components/AdminTwoFactorSetup'

interface TwoFactorProviderProps {
  children: ReactNode
}

const TwoFactorProvider: React.FC<TwoFactorProviderProps> = ({ children }) => {
  const { user, refreshCookie } = useAuth()
  const [showSetup, setShowSetup] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [verificationSuccess, setVerificationSuccess] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [lastUserId, setLastUserId] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDarkMode(isDark)
    }

    checkDarkMode()

    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkDarkMode)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', checkDarkMode)
    }
  }, [])

  // Safety timeout to prevent being stuck in checking state
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isChecking) {
        console.warn('TwoFactorProvider: Timeout reached, forcing completion of check')
        setIsChecking(false)
      }
    }, 5000) // 5 second timeout

    return () => clearTimeout(timeoutId)
  }, [isChecking])

  useEffect(() => {
    console.log('TwoFactorProvider useEffect triggered', {
      hasUser: !!user,
      userId: user?.id,
      lastUserId,
      showSetup,
      showVerification,
    })

    if (!user) {
      // Clear verification status when user logs out
      if (lastUserId) {
        console.log('TwoFactorProvider: User logged out, clearing 2FA session')
        // Clear both old and new verification keys
        localStorage.removeItem('admin-2fa-verified')
        localStorage.removeItem(`admin-2fa-verified-${lastUserId}`)
      }

      // Reset all state when user logs out
      setLastUserId(null)
      setShowSetup(false)
      setShowVerification(false)
      setVerificationError('')
      setVerificationSuccess(false)
      setTotpCode('')
      setIsVerifying(false)
      setIsChecking(false)
      return
    }

    // Check if user has changed (different login)
    if (lastUserId && lastUserId !== String(user.id)) {
      console.log('TwoFactorProvider: Different user detected, clearing previous user 2FA session')
      // Clear both old and new verification keys for previous user
      localStorage.removeItem('admin-2fa-verified')
      localStorage.removeItem(`admin-2fa-verified-${lastUserId}`)

      // Reset verification states for new user
      setShowSetup(false)
      setShowVerification(false)
      setVerificationError('')
      setVerificationSuccess(false)
      setTotpCode('')
      setIsVerifying(false)
    }

    // Update last user ID
    setLastUserId(String(user.id))

    console.log('TwoFactorProvider: Checking user 2FA status', {
      email: user.email,
      enabled: user.twoFactorAuth?.enabled,
      verified: user.twoFactorAuth?.verified,
      userId: user.id,
      previousUserId: lastUserId,
    })

    const has2FAEnabled = user.twoFactorAuth?.enabled
    const has2FAVerified = user.twoFactorAuth?.verified
    const has2FASetup = has2FAEnabled && has2FAVerified

    if (has2FAEnabled && !has2FAVerified) {
      // User has started 2FA setup but hasn't completed verification - force setup completion
      console.log(
        'TwoFactorProvider: User has 2FA enabled but not verified, requiring setup completion',
      )
      setShowSetup(true)
      setShowVerification(false)
    } else if (has2FASetup) {
      // User has fully enabled and verified 2FA - check if verification needed for this session
      const verificationKey = `admin-2fa-verified-${user.id}`
      const alreadyVerified = localStorage.getItem(verificationKey) === 'true'

      console.log('TwoFactorProvider: 2FA verification check', {
        verificationKey,
        alreadyVerified,
        localStorageValue: localStorage.getItem(verificationKey),
      })

      if (!alreadyVerified) {
        console.log('TwoFactorProvider: User has 2FA enabled, requiring verification')
        setShowVerification(true)
        setShowSetup(false)
      } else {
        console.log('TwoFactorProvider: User already verified in this session')
        setShowVerification(false)
        setShowSetup(false)
      }
    } else {
      // User doesn't have 2FA enabled at all - allow them to access admin without 2FA
      console.log('TwoFactorProvider: User does not have 2FA enabled, allowing access')
      setShowVerification(false)
      setShowSetup(false)
    }

    setIsChecking(false)
  }, [user])

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totpCode.length !== 6) return

    setIsVerifying(true)
    setVerificationError('')

    try {
      const response = await fetch('/api/users/2fa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpCode }),
      })

      if (response.ok) {
        console.log('Admin 2FA verification successful')
        // Store verification with user ID to make it user-specific
        const verificationKey = `admin-2fa-verified-${user?.id}`
        localStorage.setItem(verificationKey, 'true')
        setVerificationSuccess(true)
        setVerificationError('')

        setTimeout(() => {
          setShowVerification(false)
        }, 1500)
      } else {
        const result = await response.json()
        setVerificationError(result.message || 'קוד אימות שגוי')
        setTotpCode('')
      }
    } catch (error) {
      setVerificationError('שגיאה בחיבור לשרת')
      setTotpCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  // Get theme colors
  const getThemeColors = () => ({
    background: isDarkMode ? '#1f2937' : '#ffffff',
    text: isDarkMode ? '#f9fafb' : '#111827',
    textSecondary: isDarkMode ? '#d1d5db' : '#6b7280',
    border: isDarkMode ? '#374151' : '#d1d5db',
    error: isDarkMode ? '#fca5a5' : '#d32f2f',
    errorBg: isDarkMode ? '#451a1a' : '#ffebee',
    errorBorder: isDarkMode ? '#7f1d1d' : '#ffcdd2',
    success: isDarkMode ? '#86efac' : '#2e7d32',
    successBg: isDarkMode ? '#14532d' : '#e8f5e8',
    successBorder: isDarkMode ? '#166534' : '#c8e6c9',
    overlay: isDarkMode ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.90)',
    input: isDarkMode ? '#374151' : '#ffffff',
    inputBorder: isDarkMode ? '#4b5563' : '#d1d5db',
    button: '#1976d2',
    buttonHover: '#1565c0',
    buttonDisabled: isDarkMode ? '#4b5563' : '#e5e7eb',
  })

  // Full-screen overlay that blocks all interaction
  const renderOverlay = (content: ReactNode) => {
    const colors = getThemeColors()

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.overlay,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          // Prevent text selection
          if (e.target === e.currentTarget) {
            e.preventDefault()
          }
        }}
      >
        {content}
      </div>
    )
  }

  // Show setup overlay
  if (showSetup) {
    const colors = getThemeColors()

    return (
      <>
        {renderOverlay(
          <div
            style={{
              backgroundColor: colors.background,
              borderRadius: '8px',
              padding: '40px',
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.8)'
                : '0 4px 20px rgba(0, 0, 0, 0.3)',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  margin: '0 0 10px 0',
                  color: colors.error,
                }}
              >
                הגדרת אימות דו-שלבי נדרשת
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: '14px', margin: 0 }}>
                למטרות אבטחה, עליך להגדיר אימות דו-שלבי כדי לגשת לממשק הניהול
              </p>
            </div>

            <AdminTwoFactorSetup
              onComplete={async () => {
                console.log('2FA setup completed')
                await refreshCookie()
                await new Promise((resolve) => setTimeout(resolve, 500))
                setShowSetup(false)
              }}
              onCancel={undefined}
            />
          </div>,
        )}
        {children}
      </>
    )
  }

  // Show verification overlay
  if (showVerification) {
    const colors = getThemeColors()

    return (
      <>
        {renderOverlay(
          <div
            style={{
              backgroundColor: colors.background,
              borderRadius: '8px',
              padding: '40px',
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.8)'
                : '0 4px 20px rgba(0, 0, 0, 0.3)',
              maxWidth: '400px',
              width: '100%',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  margin: '0 0 10px 0',
                  color: colors.button,
                }}
              >
                אימות דו-שלבי
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: '14px', margin: 0 }}>
                הזן את קוד האימות מהאפליקציה שלך כדי להשלים את ההתחברות
              </p>
            </div>

            <form onSubmit={handleVerification}>
              {verificationError && (
                <div
                  style={{
                    backgroundColor: colors.errorBg,
                    color: colors.error,
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    textAlign: 'center',
                    border: `1px solid ${colors.errorBorder}`,
                  }}
                >
                  {verificationError}
                </div>
              )}

              {verificationSuccess && (
                <div
                  style={{
                    backgroundColor: colors.successBg,
                    color: colors.success,
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    textAlign: 'center',
                    border: `1px solid ${colors.successBorder}`,
                  }}
                >
                  ✓ אימות מוצלח! מעביר לממשק הניהול...
                </div>
              )}

              <div style={{ marginBottom: '30px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '500',
                    color: colors.text,
                  }}
                >
                  קוד אימות דו-שלבי:
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={isVerifying || verificationSuccess}
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '4px',
                    fontSize: '18px',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    backgroundColor: colors.input,
                    color: colors.text,
                  }}
                  placeholder="123456"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || verificationSuccess || totpCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: verificationSuccess
                    ? colors.success
                    : isVerifying || totpCode.length !== 6
                      ? colors.buttonDisabled
                      : colors.button,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor:
                    isVerifying || verificationSuccess || totpCode.length !== 6
                      ? 'not-allowed'
                      : 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                {verificationSuccess ? '✓ מאומת' : isVerifying ? 'מאמת...' : 'אמת קוד'}
              </button>
            </form>
          </div>,
        )}
        {children}
      </>
    )
  }

  // Show loading state while checking
  if (isChecking) {
    console.log('TwoFactorProvider: Still checking, showing loading state')
    const colors = getThemeColors()

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: '14px',
          color: colors.textSecondary,
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        }}
      >
        בודק מצב האימות...
      </div>
    )
  }

  // If we get here, user is properly authenticated and no 2FA needed
  //  console.log('TwoFactorProvider: Rendering children - user authenticated, no 2FA needed')
  return <>{children}</>
}

export default TwoFactorProvider
