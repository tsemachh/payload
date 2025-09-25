'use client'

import { useState } from 'react'
import { CheckCircle2, Shield, Copy, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface AdminTwoFactorSetupProps {
  onComplete?: () => void
  onCancel?: () => void
}

export function AdminTwoFactorSetup({ onComplete, onCancel }: AdminTwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup')
  const [qrCode, setQrCode] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  const handleSetup = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/users/2fa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'שגיאה בהגדרת אימות דו-שלבי')
      }

      const result = await response.json()
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
      const response = await fetch('/api/users/2fa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationCode,
          enableAfterVerification: true,
        }),
      })

      if (response.ok) {
        setStep('complete')
        console.log('2FA setup completed successfully')
      } else {
        const errorData = await response.json()
        console.error('2FA verification failed:', errorData)
        setError(errorData.error || errorData.message || 'קוד שגוי. אנא נסה שוב.')
      }
    } catch (err) {
      setError((err as Error).message || 'שגיאה באימות הקוד')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    console.log('הועתק ללוח')
  }

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    console.log('קודי הגיבוי הועתקו ללוח')
  }

  if (step === 'setup') {
    return (
      <div style={{ width: '100%', maxWidth: '28rem', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ 
            margin: '0 auto 16px auto', 
            display: 'flex', 
            height: '48px', 
            width: '48px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '50%', 
            backgroundColor: '#dbeafe' 
          }}>
            <Shield style={{ height: '24px', width: '24px', color: '#2563eb' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>הגדרת אימות דו-שלבי</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>
            הוסף רמת אבטחה נוספת לחשבון שלך
          </p>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {error && (
            <div style={{
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertCircle style={{ height: '16px', width: '16px' }} />
              {error}
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#666' }}>
            <p style={{ marginBottom: '8px' }}>אימות דו-שלבי מוסיף רמת הגנה נוספת לחשבון שלך.</p>
            <p>תצטרך אפליקציה כמו Google Authenticator או Authy.</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button 
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          )}
          <button 
            onClick={handleSetup} 
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: isLoading ? '#ccc' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'מתחיל...' : 'התחל הגדרה'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <div style={{ width: '100%', maxWidth: '28rem', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>סרוק את קוד ה-QR</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>
            השתמש באפליקציית האימות שלך לסריקת הקוד
          </p>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          {error && (
            <div style={{
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertCircle style={{ height: '16px', width: '16px' }} />
              {error}
            </div>
          )}
          
          {qrCode && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <img src={qrCode} alt="QR Code" style={{ border: '1px solid #d1d5db', borderRadius: '8px' }} />
              
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
                  או הזן ידנית:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', direction: 'ltr' }}>
                  <input
                    value={manualKey}
                    readOnly
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      backgroundColor: '#f9fafb',
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(manualKey)}
                    style={{
                      padding: '8px',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy style={{ height: '16px', width: '16px' }} />
                  </button>
                </div>
              </div>

              <div style={{ width: '100%' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                  הזן קוד אימות (6 ספרות):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    boxSizing: 'border-box',
                  }}
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button 
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          )}
          <button 
            onClick={handleVerify}
            disabled={isLoading || verificationCode.length !== 6}
            style={{
              flex: 1,
              padding: '12px 16px',
              backgroundColor: isLoading || verificationCode.length !== 6 ? '#ccc' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isLoading || verificationCode.length !== 6 ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'מאמת...' : 'אמת'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div style={{ width: '100%', maxWidth: '28rem', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ 
            margin: '0 auto 16px auto', 
            display: 'flex', 
            height: '48px', 
            width: '48px', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderRadius: '50%', 
            backgroundColor: '#dcfce7' 
          }}>
            <CheckCircle2 style={{ height: '24px', width: '24px', color: '#16a34a' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>אימות דו-שלבי הופעל!</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>
            החשבון שלך מוגן כעת באימות דו-שלבי
          </p>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            backgroundColor: '#f0f9ff',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}>
            <Shield style={{ height: '16px', width: '16px', color: '#0ea5e9', marginTop: '2px' }} />
            <div>
              <strong>חשוב:</strong> שמור את קודי הגיבוי הבאים במקום בטוח. 
              תוכל להשתמש בהם אם תאבד גישה לאפליקציית האימות.
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>
                קודי גיבוי ({backupCodes.length} קודים):
              </label>
              <button
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                style={{
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {showBackupCodes ? <EyeOff style={{ height: '16px', width: '16px' }} /> : <Eye style={{ height: '16px', width: '16px' }} />}
              </button>
            </div>
            
            {showBackupCodes && (
              <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '4px', 
                  fontFamily: 'monospace', 
                  fontSize: '12px',
                  direction: 'ltr' 
                }}>
                  {backupCodes.map((code, index) => (
                    <div key={index} style={{ textAlign: 'center', padding: '4px' }}>
                      {code}
                    </div>
                  ))}
                </div>
                <button
                  onClick={copyBackupCodes}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Copy style={{ height: '16px', width: '16px' }} />
                  העתק קודי גיבוי
                </button>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={onComplete}
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          סיום
        </button>
      </div>
    )
  }

  return null
}