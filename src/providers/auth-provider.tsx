'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
//import type { Permissions } from 'payload/auth'
import type { User } from '@/payload-types'
import type { AuthContext, ForgotPassword, Login, Logout, ResetPassword } from './auth/types'
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

  return (
    <Context.Provider
      value={{
        user,
        setUser,
        login,
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
