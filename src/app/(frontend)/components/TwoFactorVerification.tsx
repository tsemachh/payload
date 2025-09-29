'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertCircle, KeyRound } from 'lucide-react'

interface TwoFactorVerificationProps {
  email: string
  password: string
  onVerified: (user: any) => void
  onCancel: () => void
  onLoginWithCredentials: (args: { email: string; password: string; totpCode?: string; backupCode?: string }) => Promise<any>
}

export function TwoFactorVerification({ 
  email, 
  password, 
  onVerified, 
  onCancel,
  onLoginWithCredentials 
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState('')
  const [isBackupCode, setIsBackupCode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('אנא הזן קוד אימות')
      return
    }

    if (!isBackupCode && code.replace(/\s/g, '').length !== 6) {
      setError('קוד TOTP חייב להכיל 6 ספרות')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const loginArgs = {
        email,
        password,
        ...(isBackupCode 
          ? { backupCode: code.replace(/\s/g, '').toUpperCase() }
          : { totpCode: code.replace(/\s/g, '') }
        )
      }

      const result = await onLoginWithCredentials(loginArgs)

      if (result.user) {
        onVerified(result.user)
      } else {
        setError('אימות נכשל')
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה באימות')
      
      // Handle rate limiting or attempts remaining
      if (err.attemptsRemaining !== undefined) {
        setAttemptsRemaining(err.attemptsRemaining)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>אימות דו-שלבי</CardTitle>
        <CardDescription>
          הזן את קוד האימות מהאפליקציה שלך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {attemptsRemaining !== null && attemptsRemaining >= 0 && (
                <div className="mt-1 text-xs">
                  נותרו {attemptsRemaining} ניסיונות
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="verificationCode">
            {isBackupCode ? 'קוד גיבוי:' : 'קוד אימות (6 ספרות):'}
          </Label>
          <Input
            id="verificationCode"
            type="text"
            value={code}
            onChange={(e) => {
              const value = e.target.value
              if (isBackupCode) {
                setCode(value.toUpperCase())
              } else {
                setCode(value.replace(/\D/g, ''))
              }
            }}
            onKeyPress={handleKeyPress}
            maxLength={isBackupCode ? 8 : 6}
            placeholder={isBackupCode ? "AB12CD34" : "123456"}
            className="text-center font-mono text-lg"
            dir="ltr"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsBackupCode(!isBackupCode)
              setCode('')
              setError('')
            }}
            className="text-sm"
          >
            <KeyRound className="h-4 w-4 ml-2" />
            {isBackupCode ? 'השתמש בקוד TOTP' : 'השתמש בקוד גיבוי'}
          </Button>
        </div>

        {!isBackupCode && (
          <div className="text-xs text-muted-foreground text-center">
            <p>פתח את אפליקציית האימות שלך (Google Authenticator, Authy וכו')</p>
            <p>והזן את הקוד בן 6 הספרות עבור EMDA</p>
          </div>
        )}

        {isBackupCode && (
          <div className="text-xs text-muted-foreground text-center">
            <p>הזן אחד מקודי הגיבוי שקיבלת בעת הגדרת האימות הדו-שלבי</p>
            <p className="text-yellow-600 font-medium">שים לב: כל קוד גיבוי ניתן לשימוש פעם אחת בלבד</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>
          ביטול
        </Button>
        <Button 
          onClick={handleVerify} 
          disabled={isLoading || !code.trim() || (!isBackupCode && code.length !== 6)} 
          className="flex-1"
        >
          {isLoading ? 'מאמת...' : 'אמת'}
        </Button>
      </CardFooter>
    </Card>
  )
}