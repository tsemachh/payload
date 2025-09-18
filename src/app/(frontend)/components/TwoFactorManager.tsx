'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, ShieldCheck, ShieldX, RefreshCw, Copy, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { TwoFactorSetup } from './TwoFactorSetup'
import { toast } from 'sonner'

interface TwoFactorManagerProps {
  className?: string
}

export function TwoFactorManager({ className }: TwoFactorManagerProps) {
  const [showSetup, setShowSetup] = useState(false)
  const [showDisable, setShowDisable] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([])
  const [showNewCodes, setShowNewCodes] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { user, disable2FA, regenerateBackupCodes } = useAuth()

  const is2FAEnabled = user?.twoFactorAuth?.enabled && user?.twoFactorAuth?.verified

  const handleDisable2FA = async () => {
    if (!currentPassword) {
      setError('נדרשת סיסמה נוכחית')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const success = await disable2FA({ currentPassword })
      if (success) {
        setShowDisable(false)
        setCurrentPassword('')
        toast.success('אימות דו-שלבי בוטל בהצלחה')
      }
    } catch (err) {
      setError((err as Error).message || 'שגיאה בביטול אימות דו-שלבי')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    setIsLoading(true)
    setError('')

    try {
      const codes = await regenerateBackupCodes()
      setNewBackupCodes(codes)
      setShowNewCodes(true)
      toast.success('קודי גיבוי חדשים נוצרו')
    } catch (err) {
      setError((err as Error).message || 'שגיאה ביצירת קודי גיבוי חדשים')
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    const codesText = newBackupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    toast.success('קודי הגיבוי הועתקו ללוח')
  }

  if (showSetup) {
    return (
      <div className={className}>
        <TwoFactorSetup
          onComplete={() => {
            setShowSetup(false)
            toast.success('אימות דו-שלבי הופעל בהצלחה!')
          }}
          onCancel={() => setShowSetup(false)}
        />
      </div>
    )
  }

  if (showNewCodes && newBackupCodes.length > 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <CardTitle>קודי גיבוי חדשים</CardTitle>
          </div>
          <CardDescription>
            קודי הגיבוי החדשים שלך מוכנים
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>חשוב:</strong> שמור את הקודים החדשים במקום בטוח. 
              הקודים הישנים כבר לא יעבדו.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm" dir="ltr">
              {newBackupCodes.map((code, index) => (
                <div key={index} className="text-center py-1 bg-background rounded px-2">
                  {code}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyBackupCodes}
              className="w-full mt-3"
            >
              <Copy className="h-4 w-4 mr-2" />
              העתק קודי גיבוי
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => setShowNewCodes(false)} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            שמרתי את הקודים
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {is2FAEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldX className="h-5 w-5 text-gray-400" />
          )}
          <CardTitle>אימות דו-שלבי (2FA)</CardTitle>
        </div>
        <CardDescription>
          {is2FAEnabled 
            ? 'החשבון שלך מוגן באימות דו-שלבי' 
            : 'הוסף רמת אבטחה נוספת לחשבון שלך'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {is2FAEnabled ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">אימות דו-שלבי פעיל</p>
                <p className="text-xs text-green-600">
                  החשבון שלך מוגן בשכבת אבטחה נוספת
                </p>
              </div>
            </div>

            {showDisable ? (
              <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <Label htmlFor="currentPassword" className="text-red-800 font-medium">
                  הזן סיסמה נוכחית לביטול:
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="הסיסמה הנוכחית שלך"
                  disabled={isLoading}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDisable(false)
                      setCurrentPassword('')
                      setError('')
                    }}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisable2FA}
                    disabled={isLoading || !currentPassword}
                    className="flex-1"
                  >
                    {isLoading ? 'מבטל...' : 'בטל אימות דו-שלבי'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleRegenerateBackupCodes}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isLoading ? 'יוצר קודי גיבוי חדשים...' : 'צור קודי גיבוי חדשים'}
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setShowDisable(true)}
                  className="w-full"
                >
                  <ShieldX className="h-4 w-4 mr-2" />
                  בטל אימות דו-שלבי
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                <strong>למה אימות דו-שלבי חשוב?</strong>
              </p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>מגן מפני גישה לא מורשית</li>
                <li>דורש גם סיסמה וגם קוד מהטלפון</li>
                <li>מגביר משמעותית את רמת האבטחה</li>
              </ul>
            </div>

            <Button onClick={() => setShowSetup(true)} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              הפעל אימות דו-שלבי
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}