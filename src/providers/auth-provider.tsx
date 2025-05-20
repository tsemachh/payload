'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
//import type { Permissions } from 'payload/auth'
import type { User } from '@/payload-types'
import type { AuthContext,  ForgotPassword, Login, Logout, ResetPassword } from './auth/types'

const Context = createContext({} as AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<null | User>()
//  const [permissions, setPermissions] = useState<null | Permissions>(null)

  const login = useCallback<Login>(
    async (args) => {
      try {
        const res = await fetch(`/api/users/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
        })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.errors?.[0]?.message || 'Login failed')
      }

      setUser(result.user)
      return result.user
    } catch (error) {
      console.error('Error logging in:', error)
      throw error
    }
  }, [])

  const logout = useCallback<Logout>(async () => {
    try {
      const headers = {
        Authorization: '',
        'Content-Type': 'application/json',
      }
      await fetch(`/api/users/logout`, {
        method: 'POST',
        headers
      })
      setUser(null)
    } catch (error) {
      console.error('Error logging out:', error)
      throw error
    }
  }, [])

  // On mount, get user and set
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch(`/api/users/me`, {
          method: 'GET',
        })
        const user = await res.json();

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

  const forgotPassword = useCallback<ForgotPassword>(
    async (args) => {
      try {
        const res = await fetch(`/api/users/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
        })

        if (!res.ok) {
          throw new Error('Forgot password request failed')
        }

        return true
      } catch (error) {
        console.error('Error in forgot password:', error)
        throw error
      }
    },
    [],
  )

  const resetPassword = useCallback<ResetPassword>(
    async (args) => {
      try {
        const res = await fetch(`/api/users/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
        });

        if (!res.ok) {
          throw new Error('Reset password failed')
        }

        const user = await res.json();

        setUser(user)
        return user
      } catch (error) {
        console.error('Error resetting password:', error)
        throw error
      }
    },
    [],
  )

  return (
    <Context.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        forgotPassword,
        resetPassword,
        create: login
      }}
    >
      {children}
    </Context.Provider>
  )
}

export const useAuth = () => useContext(Context)
