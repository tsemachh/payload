'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
//import type { Permissions } from 'payload/auth'
import type { User } from '@/payload-types'
import type { 
  AuthContext, 
  ForgotPassword, 
  Login, 
  LoginWith2FA,
  Verify2FA,
  Setup2FA,
  Disable2FA,
  RegenerateBackupCodes,
  Logout, 
  ResetPassword 
} from './auth/types'
import { handleApiError, notifyError } from '@/app/(frontend)/helpers/error-handler'
import { getWithErrorHandling, postWithErrorHandling } from '@/app/(frontend)/helpers/fetch-helpers'

const Context = createContext({} as AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<null | User>()
  //  const [permissions, setPermissions] = useState<null | Permissions>(null)

  const login = useCallback<Login>(async (args) => {
    try {
      const result = await postWithErrorHandling('/api/users/login', args, {
        errorMessage: 'שגיאה בהתחברות למערכת',
        notifyOnError: false // We'll handle notification ourselves
      });

      setUser(result.user)
      return result.user
    } catch (error) {
      // Use the error handler to log and notify
      notifyError({ message: (error as any)?.message || 'שגיאה בהתחברות למערכת' })
      throw error
    }
  }, [])

  const logout = useCallback<Logout>(async () => {
    try {
      await postWithErrorHandling('/api/users/logout', {}, {
        headers: {
          Authorization: '',
          'Content-Type': 'application/json',
        },
        errorMessage: 'שגיאה בהתנתקות מהמערכת',
        notifyOnError: false // We'll handle notification ourselves
      })
      setUser(null)
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה בהתנתקות מהמערכת' })
      throw error
    }
  }, [])

  // On mount, get user and set
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const user = await getWithErrorHandling('/api/users/me', {
          notifyOnError: false // Don't notify on error, just set user to null
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
        notifyOnError: false // We'll handle notification ourselves
      })

      return true
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה בשליחת בקשה לאיפוס סיסמה' })
      throw error
    }
  }, [])

  const resetPassword = useCallback<ResetPassword>(async (args) => {
    try {
      const user = await postWithErrorHandling('/api/users/reset-password', args, {
        errorMessage: 'שגיאה באיפוס סיסמה',
        notifyOnError: false // We'll handle notification ourselves
      })

      setUser(user)
      return user
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה באיפוס סיסמה' })
      throw error
    }
  }, [])

  // Enhanced login with 2FA support
  const loginWith2FA = useCallback<LoginWith2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling('/api/users/login-2fa', {
        email: args.email,
        password: args.password,
        totpCode: args.totpCode,
        backupCode: args.backupCode,
        isBackupCode: !!args.backupCode,
      }, {
        errorMessage: 'שגיאה בהתחברות למערכת',
        notifyOnError: false
      })

      // Check if 2FA is required
      if (result.requires2FA) {
        return { requiresTwoFactor: true }
      }

      // Successful login (with or without 2FA)
      if (result.success && result.user) {
        setUser(result.user)
        return { 
          user: result.user,
          remainingBackupCodes: result.remainingBackupCodes 
        }
      }

      throw new Error('שגיאה בהתחברות')
      
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה בהתחברות למערכת' })
      throw error
    }
  }, [])

  // Verify 2FA code
  const verify2FA = useCallback<Verify2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling('/api/users/2fa-verify', {
        token: args.token,
        isBackupCode: args.isBackupCode,
      }, {
        errorMessage: 'שגיאה באימות דו-שלבי',
        notifyOnError: false
      })

      return result.success
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה באימות דו-שלבי' })
      throw error
    }
  }, [])

  // Setup 2FA
  const setup2FA = useCallback<Setup2FA>(async () => {
    try {
      const result = await postWithErrorHandling('/api/users/2fa-setup', {}, {
        errorMessage: 'שגיאה בהגדרת אימות דו-שלבי',
        notifyOnError: false
      })

      return {
        qrCode: result.qrCode,
        manualEntryKey: result.manualEntryKey,
        backupCodes: result.backupCodes,
      }
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה בהגדרת אימות דו-שלבי' })
      throw error
    }
  }, [])

  // Disable 2FA
  const disable2FA = useCallback<Disable2FA>(async (args) => {
    try {
      const result = await postWithErrorHandling('/api/users/2fa-disable', args, {
        errorMessage: 'שגיאה בביטול אימות דו-שלבי',
        notifyOnError: false
      })

      // Refresh user data
      const updatedUser = await getWithErrorHandling('/api/users/me', {
        notifyOnError: false
      })
      if (updatedUser) {
        setUser(updatedUser.user)
      }

      return result.success
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה בביטול אימות דו-שלבי' })
      throw error
    }
  }, [])

  // Regenerate backup codes
  const regenerateBackupCodes = useCallback<RegenerateBackupCodes>(async () => {
    try {
      const result = await postWithErrorHandling('/api/users/2fa-backup-codes', {}, {
        errorMessage: 'שגיאה ביצירת קודי גיבוי חדשים',
        notifyOnError: false
      })

      return result.backupCodes
    } catch (error) {
      notifyError({ message: (error as any)?.message || 'שגיאה ביצירת קודי גיבוי חדשים' })
      throw error
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
