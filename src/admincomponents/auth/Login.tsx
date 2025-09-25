"use client"

import React, { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

// Minimal custom login component that supports optional MFA (TOTP)
// It checks if MFA is enabled for the given email/password and either
// prompts for keycode or logs in directly.

type LoginPayload = {
  email: string
  password: string
  keycode?: string
}

const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/

export default function Login(): React.JSX.Element {
  const baseClass = 'login'
  const {
    register,
    watch,
    formState: { errors, isValid },
  } = useForm<LoginPayload>({ mode: 'onChange' })

  const email = watch('email')
  const password = watch('password')
  const keycode = watch('keycode')

  const [isShowKeycode, setIsShowKeyCode] = useState(false)

  const headers = useMemo(() => ({ 'Content-Type': 'application/json' }), [])

  const checkIsMFAEnabled = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/users/login/check`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      const enabled = Boolean(data?.isMfaEnabled)
      setIsShowKeyCode(enabled)
      if (!enabled) {
        await login()
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'אירעה שגיאה בבדיקת אימות דו-שלבי')
    }
  }

  const login = async (): Promise<void> => {
    try {
      const res = await fetch(`/api/users/login`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email, password, keycode }),
      })
      const result = await res.json()

      if (res.ok && result?.token) {
        try {
          localStorage.setItem('token', result.token)
        } catch {}
        // Redirect to admin root
        window.location.href = '/admin'
        return
      }

      if (result?.errors?.[0]?.message) {
        toast.error(result.errors[0].message)
      } else {
        toast.error('פרטי ההתחברות שגויים')
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'אירעה שגיאה בהתחברות')
    }
  }

  const handleKeyPressLogin = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event?.key === 'Enter') {
      if (isShowKeycode && isValid) {
        event.preventDefault()
        void login()
      } else if (isValid) {
        event.preventDefault()
        void checkIsMFAEnabled()
      }
    }
  }

  return (
    <div>
      <section className="login template-minimal template-minimal--width-normal">
        <div className="template-minimal__wrap">
          <form className="login__form form" onKeyDown={(e) => handleKeyPressLogin(e)}>
            {isShowKeycode ? (
              <div className="login__inputWrap">
                <div className="field-type email">
                  <label className="field-label" htmlFor="field-keycode">
                    קוד אימות
                    <span className="required">*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      id="field-keycode"
                      type="number"
                      {...register('keycode', { required: true })}
                      className={errors?.keycode ? `${baseClass}__invalid` : ''}
                      placeholder={'הזן קוד אימות מהאפליקציה'}
                    />
                    <p className="login__invalid">
                      {errors?.keycode ? <span>קוד אימות נדרש</span> : <span className="hidden">hidden</span>}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="login__inputWrap">
                <div className="field-type email">
                  <label className="field-label" htmlFor="field-email">
                    דוא"ל
                    <span className="required">*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      autoComplete="email"
                      id="field-email"
                      type="email"
                      className={errors?.email ? `${baseClass}__invalid` : ''}
                      placeholder={'you@example.com'}
                      {...register('email', { required: true, pattern: EMAIL_REGEX })}
                    />
                    <p className="login__invalid">
                      {errors?.email ? (
                        <span>נא להזין דוא"ל תקין</span>
                      ) : (
                        <span className="hidden">hidden</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="field-type password">
                  <label className="field-label" htmlFor="field-password">
                    סיסמה
                    <span className="required">*</span>
                  </label>
                  <input
                    autoComplete="off"
                    id="field-password"
                    type="password"
                    className={errors?.password ? `${baseClass}__invalid` : ''}
                    placeholder={'••••••••••'}
                    {...register('password', { required: true, minLength: 6 })}
                  />
                  <p className="login__invalid">
                    {errors?.password ? <span>נא להזין סיסמה</span> : <span className="hidden">hidden</span>}
                  </p>
                </div>
              </div>
            )}
            {!isShowKeycode && (
              <a href="/admin/forgot" className="login__forgot">
                שכחת סיסמה?
              </a>
            )}
            <div className="form-submit">
              {isShowKeycode ? (
                <button
                  onClick={() => void login()}
                  type="button"
                  className="btn btn--style-primary btn--icon-style-without-border btn--size-medium btn--icon-position-right">
                  <span className="btn__content">
                    <span className="btn__label">אישור</span>
                  </span>
                </button>
              ) : (
                <button
                  disabled={!isValid}
                  onClick={(e) => {
                    e.preventDefault()
                    void checkIsMFAEnabled()
                  }}
                  type="button"
                  className="btn btn--style-primary btn--icon-style-without-border btn--size-medium btn--icon-position-right">
                  <span className="btn__content">
                    <span className="btn__label">כניסה</span>
                  </span>
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
