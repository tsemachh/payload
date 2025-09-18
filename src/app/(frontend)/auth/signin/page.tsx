'use client'

import React, { Suspense, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import LogoImage from '@/graphics/Logo/emda_logo.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import { useAuth } from '@/providers/auth-provider'
import TurnstileCaptcha, { TurnstileStatus } from '@/components/TurnstileCaptcha'
import { v4 as uuidv4 } from 'uuid'
import { postWithErrorHandling, getWithErrorHandling } from '@/app/(frontend)/helpers/fetch-helpers'
import { TwoFactorSetup } from '@/components/TwoFactorSetup'

// Client component that uses useSearchParams
function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: '',
  })
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('required')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [requiresSetup, setRequiresSetup] = useState(false)
  const [tempUser, setTempUser] = useState<any>(null)
  const idempotencyKey = useRef(uuidv4()).current
  const { login, setUser } = useAuth()

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token)
    setTurnstileStatus('success')
  }

  const handleTurnstileError = () => {
    setTurnstileStatus('error')
    setTurnstileToken(null)
  }

  const handleTurnstileExpire = () => {
    setTurnstileStatus('expired')
    setTurnstileToken(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Only verify Turnstile on first login attempt, not when submitting 2FA code
    if (!requiresTwoFactor) {
      if (turnstileStatus !== 'success' || !turnstileToken) {
        setError('אנא אמת שאינך רובוט')
        return
      }
    }

    setIsLoading(true)
    setError('')

    try {
      // Only verify Turnstile token on first login attempt
      if (!requiresTwoFactor) {
        const verifyResult = await postWithErrorHandling(
          '/api/verify-turnstile',
          {
            token: turnstileToken,
            idempotencyKey,
          },
          {
            errorMessage: 'אימות האבטחה נכשל',
            notifyOnError: true, // We'll handle errors manually
          },
        )

        if (!verifyResult.success) {
          setError('אימות האבטחה נכשל. אנא נסה שוב.')
          setTurnstileStatus('required')
          setIsLoading(false)
          return
        }
      }

      // Attempt login with regular endpoint
      const user = await login({
        email: formData.email,
        password: formData.password,
        totpCode: requiresTwoFactor ? formData.totpCode : undefined,
      })

      // Check if user needs 2FA setup
      const has2FASetup = user.twoFactorAuth?.enabled && user.twoFactorAuth?.verified
      
      if (!has2FASetup) {
        setRequiresSetup(true)
        setTempUser(user)
        setError('')
        setIsLoading(false)
        return
      }

      // User has 2FA setup - redirect normally
      router.push(callbackUrl)
      router.refresh()
    } catch (error: any) {
      // Check if this is a 2FA required case (which is a legitimate flow, not an error)
      if (error.requires2FA) {
        console.log('2FA required detected, showing TOTP input')
        setRequiresTwoFactor(true)
        setError('')
      } else {
        console.log('Actual login error:', error)
        setError(error instanceof Error ? error.message : 'שגיאה בכניסה למערכת')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle 2FA setup requirement
  if (requiresSetup && tempUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="w-full max-w-md">
          <Card className="mb-4">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <Image src={LogoImage} alt="Emda Logo" width={150} height={150} priority />
              </div>
              <CardTitle className="text-center text-red-600">אימות דו-שלבי נדרש</CardTitle>
              <CardDescription className="text-center">
                למטרות אבטחה, עליך להגדיר אימות דו-שלבי כדי להמשיך
              </CardDescription>
            </CardHeader>
          </Card>
          
          <TwoFactorSetup
            onComplete={async () => {
              try {
                // Fetch updated user data after successful 2FA setup
                const updatedUserResponse = await getWithErrorHandling('/api/users/me', {
                  notifyOnError: false
                })
                
                if (updatedUserResponse?.user) {
                  // Update the user in auth context with the fresh data
                  setUser(updatedUserResponse.user)
                }
                
                // After successful setup, update state and redirect
                setRequiresSetup(false)
                setTempUser(null)
                router.push(callbackUrl)
                router.refresh()
              } catch (error) {
                // If fetching updated user fails, still proceed with redirect
                setRequiresSetup(false)
                setTempUser(null)
                router.push(callbackUrl)
                router.refresh()
              }
            }}
            onCancel={undefined} // No cancel option - setup is mandatory
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Image src={LogoImage} alt="Emda Logo" width={150} height={150} priority />
          </div>
          <CardTitle className="text-2xl font-bold text-center">התחברות</CardTitle>
          <CardDescription className="text-center">
            {requiresTwoFactor
              ? 'הזן את קוד האימות הדו-שלבי כדי להשלים את ההתחברות'
              : requiresSetup
              ? 'עליך להגדיר אימות דו-שלבי לפני הכניסה למערכת'
              : 'הזן את פרטי ההתחברות שלך כדי להיכנס למערכת'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">סיסמה</Label>
                <Link href="/auth/reset-password" className="text-sm text-primary hover:underline">
                  שכחת סיסמה?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            {requiresTwoFactor && (
              <div className="space-y-2">
                <Label htmlFor="totpCode">קוד אימות דו-שלבי</Label>
                <Input
                  id="totpCode"
                  type="text"
                  placeholder="123456"
                  value={formData.totpCode}
                  onChange={(e) => setFormData({ ...formData, totpCode: e.target.value })}
                  required={requiresTwoFactor}
                  disabled={isLoading}
                  maxLength={6}
                  minLength={6}
                />
                <p className="text-sm text-muted-foreground">הזן את הקוד מאפליקציית האימות שלך</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                (!requiresTwoFactor && turnstileStatus !== 'success') ||
                (requiresTwoFactor && !formData.totpCode)
              }
            >
              {isLoading ? 'מתחבר...' : requiresTwoFactor ? 'אמת קוד' : 'התחבר'}
            </Button>
            {!requiresTwoFactor && (
              <div className="space-y-2 mb-4">
                <Label htmlFor="turnstile">אימות אבטחה</Label>
                <TurnstileCaptcha
                  onVerify={handleTurnstileVerify}
                  onError={handleTurnstileError}
                  onExpire={handleTurnstileExpire}
                  className="mt-2"
                />
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            אין לך חשבון? צור קשר עם מנהל המערכת
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

// Main component that wraps the content in a Suspense boundary
export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
          Loading...
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  )
}
