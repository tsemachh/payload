'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

function MFAButton() {
  const { register, handleSubmit, watch } = useForm()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  const key = watch('key') as string | undefined

  const getQRCode = async () => {
    try {
      const res = await fetch(`/api/users/qr`, { method: 'GET', credentials: 'include' })
      if (!res.ok) throw new Error('Failed to get QR')
      const data = await res.json()
      setQrCode(data?.qrCodeUrl ?? null)
    } catch (error: any) {
      toast.error(error?.message ?? 'שגיאה ביצירת קוד QR')
    }
  }

  const handleKeyValidate = async () => {
    try {
      if (key) {
        const res = await fetch(`/api/users/qr/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
        const data = await res.json()
        if (res.ok) {
          await getProfile()
          toast.success(data?.message ?? 'אימות דו-שלבי הופעל בהצלחה')
        } else {
          toast.error(data?.message ?? 'קוד אימות שגוי')
        }
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'שגיאה בהפעלת אימות דו-שלבי')
    }
  }

  const getProfile = async () => {
    try {
      const res = await fetch(`/api/users/me`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      setUser(data?.user ?? null)
      setQrCode(null)
    } catch (error: any) {
      toast.error('לא ניתן לטעון את פרטי המשתמש')
    }
  }

  useEffect(() => {
    getProfile()
  }, [])

  return (
    <form onSubmit={handleSubmit(handleKeyValidate)} className="render-fields">
      <div>
        <button
          disabled={user?.isMfaEnabled ?? false}
          type="button"
          onClick={getQRCode}
          className="btn btn--style-primary btn--icon-style-without-border btn--size-medium btn--icon-position-right">
          {user?.isMfaEnabled ? 'מאומת דו-שלבי הופעל' : 'הפעל אימות דו-שלבי'}
        </button>
        {qrCode ? (
          <div>
            <img style={{ marginBottom: '2rem' }} src={qrCode} alt="QR code" />
            <div className="login__inputWrap">
              <div className="field-type">
                <div className="field-type text read-only ">
                  <div className="input-wrapper">
                    <input
                      type="text"
                      placeholder={'הזן קוד אימות'}
                      {...register('key', { required: true })}
                      required
                    />
                  </div>
                </div>
                <button
                  className="btn btn--style-primary btn--icon-style-without-border btn--size-medium"
                  onClick={() => handleKeyValidate()}
                  type="button">
                  {'אישור'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  )
}

export default MFAButton
