'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@/payload-types'
import type {
  AuthContext,
  Disable2FA,
  ForgotPassword,
  Login,
  LoginWith2FA,
  Logout,
  RegenerateBackupCodes,
  ResetPassword,
  Setup2FA,
  Verify2FA,
} from './auth/types'
import { isUserFacingError, notifyError } from '@/app/(frontend)/helpers/error-handler'
import { getWithErrorHandling, postWithErrorHandling } from '@/app/(frontend)/helpers/fetch-helpers'

const Context = createContext({} as AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<null | User>()

  const login = useCallback<Login>(async (args) => {
    try {
      // Use fetch directly to handle 428 status as success case
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: args.email,
          password: args.password,
          ...(args.totpCode && { totpCode: args.totpCode }),
        }),
      })

      const result = await response.json()

      // Handle successful login
      if (response.ok) {
        setUser(result.user)
        return result.user
      }

      // Handle 2FA required case (428 status) as a legitimate response, not an error
      if (response.status === 428 && result.errors?.[0]?.data?.requires2FA) {
        // This is a legitimate "2FA required" response, not an error
        const twoFactorError = new Error('נדרש אימות דו-שלבי') as any
        twoFactorError.requires2FA = true
        twoFactorError.details = result
        throw twoFactorError
      }

      // Handle actual errors
      const errorMessage = result.errors?.[0]?.message || result.error || 'שגיאה בהתחברות למערכת'
      // notifyError({ message: errorMessage })

      const loginError = new Error(errorMessage) as any
      loginError.details = { ...result, status: response.status }
      throw loginError
    } catch (error: any) {
      // If it's our 2FA required "error", don't show notification - just rethrow
      if (error.requires2FA) {
        throw error
      }

      // For network errors or other unexpected errors
      if (!error.details) {
        notifyError({ message: 'שגיאה בהתחברות למערכת' })
      }
      const isUserFacing: boolean = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  const logout = useCallback<Logout>(async () => {
    try {
      await postWithErrorHandling(
        '/api/users/logout',
        {},
        {
          headers: {
            Authorization: '',
            'Content-Type': 'application/json',
          },
          errorMessage: 'שגיאה בהתנתקות מהמערכת',
          notifyOnError: false, // We'll handle notification ourselves
        },
      )
      setUser(null)
    } catch (error) {
      const isUserFacing: boolean = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  // On mount, get user and set
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const user = await getWithErrorHandling('/api/users/me', {
          notifyOnError: false, // Don't notify on error, just set user to null
        })

        if (user) {
          setUser(user.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        // If not logged in, set user to null
        setUser(null)
      }
    }

    void fetchMe()
  }, [])

  const forgotPassword = useCallback<ForgotPassword>(async (args) => {
    try {
      await postWithErrorHandling('/api/users/forgot-password', args, {
        errorMessage: 'שגיאה בשליחת בקשה לאיפוס סיסמה',
        notifyOnError: false, // We'll handle notification ourselves
      })

      return true
    } catch (error) {
      throw error
    }
  }, [])

  const resetPassword = useCallback<ResetPassword>(async (args) => {
    try {
      const user = await postWithErrorHandling('/api/users/reset-password', args, {
        errorMessage: 'שגיאה באיפוס סיסמה',
        notifyOnError: false, // We'll handle notification ourselves
      })
      setUser(user)
      return user
    } catch (error) {
      const isUserFacing = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  // Enhanced login with 2FA support
  const loginWith2FA = useCallback<LoginWith2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling(
        '/api/users/login-2fa',
        {
          email: args.email,
          password: args.password,
          totpCode: args.totpCode,
          backupCode: args.backupCode,
          isBackupCode: !!args.backupCode,
        },
        {
          errorMessage: 'שגיאה בהתחברות למערכת',
          notifyOnError: false,
        },
      )

      // Check if 2FA is required
      if (result.requires2FA) {
        return { requiresTwoFactor: true }
      }

      // Successful login - check if user needs to set up 2FA on the frontend
      if (result.success && result.user) {
        setUser(result.user)

        // Check if user needs 2FA setup
        const has2FASetup =
          result.user.twoFactorAuth?.enabled && result.user.twoFactorAuth?.verified

        if (!has2FASetup) {
          return { requiresSetup: true, user: result.user }
        }

        return {
          user: result.user,
          remainingBackupCodes: result.remainingBackupCodes,
        }
      }

      throw new Error('שגיאה בהתחברות')
    } catch (error) {
      throw error
    }
  }, [])

  // Verify 2FA code
  const verify2FA = useCallback<Verify2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling(
        '/api/users/2fa-verify',
        {
          token: args.token,
          isBackupCode: args.isBackupCode,
          enableAfterVerification: args.enableAfterVerification,
        },
        {
          errorMessage: 'שגיאה באימות דו-שלבי',
          notifyOnError: false,
        },
      )

      return result.success
    } catch (error) {
      const isUserFacing = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  // Setup 2FA
  const setup2FA = useCallback<Setup2FA>(async () => {
    try {
      const result = await postWithErrorHandling(
        '/api/users/2fa-setup',
        {},
        {
          errorMessage: 'שגיאה בהגדרת אימות דו-שלבי',
          notifyOnError: false,
        },
      )

      return {
        qrCode: result.qrCode,
        manualEntryKey: result.manualEntryKey,
        backupCodes: result.backupCodes,
      }
    } catch (error: any) {
      throw error
    }
  }, [])

  // Disable 2FA
  const disable2FA = useCallback<Disable2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling('/api/users/2fa-disable', args, {
        errorMessage: 'שגיאה בביטול אימות דו-שלבי',
        notifyOnError: false,
      })

      // Refresh user data
      const updatedUser = await getWithErrorHandling('/api/users/me', {
        notifyOnError: false,
      })
      if (updatedUser) {
        setUser(updatedUser.user)
      }

      return result.success
    } catch (error) {
      const isUserFacing = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  // Regenerate backup codes
  const regenerateBackupCodes = useCallback<RegenerateBackupCodes>(async () => {
    try {
      const result = await postWithErrorHandling(
        '/api/users/2fa-backup-codes',
        {},
        {
          errorMessage: 'שגיאה ביצירת קודי גיבוי חדשים',
          notifyOnError: false,
        },
      )

      return result.backupCodes
    } catch (error) {
      const isUserFacing = isUserFacingError(error)
      if (isUserFacing) {
        throw error
      }
    }
  }, [])

  return (
    <Context.Provider
      value={{
        user,
        setUser,
        login,
        loginWith2FA,
        verify2FA,
        setup2FA,
        disable2FA,
        regenerateBackupCodes,
        logout,
        forgotPassword,
        resetPassword,
        create: login,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export const useAuth = () => useContext(Context)
