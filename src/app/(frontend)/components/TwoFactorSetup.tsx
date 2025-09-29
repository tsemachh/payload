'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Shield, Copy, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { toast } from 'sonner'

interface TwoFactorSetupProps {
  onComplete?: () => void
  onCancel?: () => void
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup')
  const [qrCode, setQrCode] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  const { setup2FA, verify2FA } = useAuth()

  const handleSetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await setup2FA()
      setQrCode(result.qrCode)
      setManualKey(result.manualEntryKey)
      setBackupCodes(result.backupCodes)
      setStep('verify')
    } catch (err) {
      setError((err as Error).message || 'שגיאה בהגדרת אימות דו-שלבי')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('אנא הזן קוד בן 6 ספרות')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const isValid = await verify2FA({
        token: verificationCode,
        isBackupCode: false,
        enableAfterVerification: true,
      })

      if (isValid) {
        setStep('complete')
        toast.success('אימות דו-שלבי הופעל בהצלחה!')
      } else {
        setError('קוד שגוי. אנא נסה שוב.')
      }
    } catch (err) {
      setError((err as Error).message || 'שגיאה באימות הקוד')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('הועתק ללוח')
  }

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    toast.success('קודי הגיבוי הועתקו ללוח')
  }

  if (step === 'setup') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>הגדרת אימות דו-שלבי</CardTitle>
          <CardDescription>
            הוסף רמת אבטחה נוספת לחשבון שלך
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">אימות דו-שלבי מוסיף רמת הגנה נוספת לחשבון שלך.</p>
            <p>תצטרך אפליקציה כמו Google Authenticator או Authy.</p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            ביטול
          </Button>
          <Button onClick={handleSetup} disabled={isLoading} className="flex-1">
            {isLoading ? 'מתחיל...' : 'התחל הגדרה'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (step === 'verify') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>סרוק את קוד ה-QR</CardTitle>
          <CardDescription>
            השתמש באפליקציית האימות שלך לסריקת הקוד
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {qrCode && (
            <div className="flex flex-col items-center space-y-4">
              <img src={qrCode} alt="QR Code" className="border rounded-lg" />
              
              <div className="w-full">
                <Label htmlFor="manualKey" className="text-sm font-medium">
                  או הזן ידנית:
                </Label>
                <div className="flex items-center space-x-2 mt-1" dir="ltr">
                  <Input
                    id="manualKey"
                    value={manualKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(manualKey)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="w-full space-y-2">
                <Label htmlFor="verificationCode">הזן קוד אימות (6 ספרות):</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="text-center font-mono text-lg"
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            ביטול
          </Button>
          <Button 
            onClick={handleVerify} 
            disabled={isLoading || verificationCode.length !== 6} 
            className="flex-1"
          >
            {isLoading ? 'מאמת...' : 'אמת'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (step === 'complete') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>אימות דו-שלבי הופעל!</CardTitle>
          <CardDescription>
            החשבון שלך מוגן כעת באימות דו-שלבי
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>חשוב:</strong> שמור את קודי הגיבוי הבאים במקום בטוח. 
              תוכל להשתמש בהם אם תאבד גישה לאפליקציית האימות.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>קודי גיבוי ({backupCodes.length} קודים):</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBackupCodes(!showBackupCodes)}
              >
                {showBackupCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            {showBackupCodes && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="text-center py-1">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBackupCodes}
                  className="w-full mt-2"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  העתק קודי גיבוי
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onComplete} className="w-full">
            סיום
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return null
}