import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { 
  verifyTOTPToken, 
  verifyBackupCode,
  decryptTOTPSecret,
  checkRateLimit 
} from '@/utils/totpUtils'

/**
 * Enhanced login endpoint that handles 2FA
 * Path: /api/users/login-2fa
 * Method: POST
 */
const LoginWith2FAEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    
    const { 
      email, 
      password, 
      totpCode, 
      backupCode,
      isBackupCode = false 
    } = (await req.json?.()) || {}
    
    if (!email || !password) {
      return Response.json({ error: 'נדרשים אימייל וסיסמה' }, { status: 400 })
    }

    // Step 1: Try regular login first to check if 2FA is required
    let requiresTwoFactor = false
    try {
      await req.payload.login({
        collection: 'users',
        data: { email, password },
      })
    } catch (error: any) {
      // If the error indicates 2FA is required, proceed with 2FA verification
      if (error.data?.requires2FA || error.message.includes('נדרש אימות דו-שלבי')) {
        requiresTwoFactor = true
      } else {
        // Other login error (wrong credentials, etc.)
        return Response.json({ 
          error: error.message || 'אימייל או סיסמה שגויים' 
        }, { status: 401 })
      }
    }

    // Step 2: If no 2FA required, the login succeeded
    if (!requiresTwoFactor) {
      const result = await req.payload.login({
        collection: 'users',
        data: { email, password },
      })
      
      return Response.json({
        success: true,
        user: result.user,
        token: result.token,
        exp: result.exp,
      })
    }

    // Step 3: 2FA is required - check if code is provided
    if (!totpCode && !backupCode) {
      return Response.json({ 
        requires2FA: true,
        message: 'נדרש קוד אימות דו-שלבי' 
      }, { status: 200 })
    }

    // Step 4: Find user and verify 2FA code
    const users = await req.payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    })
    
    if (!users.docs.length) {
      return Response.json({ error: 'משתמש לא נמצא' }, { status: 401 })
    }
    
    const user = users.docs[0]

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(
      user.twoFactorAuth?.failureCount || 0,
      user.twoFactorAuth?.lastFailureTime ? new Date(user.twoFactorAuth.lastFailureTime) : undefined
    )
    
    if (rateLimitCheck.isLocked) {
      return Response.json({
        error: `חשבון נחסם זמנית. נסה שוב בעוד ${rateLimitCheck.remainingTime} דקות`
      }, { status: 429 })
    }

    // Verify 2FA code
    let isValid = false
    let updatedBackupCodes = user.twoFactorAuth?.backupCodes

    try {
      if (isBackupCode || backupCode) {
        // Verify backup code
        const backupCodes = (user.twoFactorAuth?.backupCodes || []).map(code => ({
          code: code.code || '',
          used: code.used || false
        }))
        const backupResult = verifyBackupCode(backupCode || totpCode, backupCodes)
        isValid = backupResult.isValid
        updatedBackupCodes = backupResult.updatedCodes
      } else {
        // Verify TOTP token
        if (!user.twoFactorAuth?.secret) {
          return Response.json({ error: 'אימות דו-שלבי לא מוגדר' }, { status: 400 })
        }
        const decryptedSecret = decryptTOTPSecret(user.twoFactorAuth.secret)
        isValid = verifyTOTPToken(totpCode, decryptedSecret)
      }
    } catch (error) {
      req.payload.logger.error('2FA verification error during login:', error)
      return Response.json({ error: 'שגיאה באימות הקוד' }, { status: 500 })
    }

    if (isValid) {
      // Update user with successful 2FA verification
      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: {
          twoFactorAuth: {
            ...user.twoFactorAuth,
            lastUsed: new Date().toISOString(),
            failureCount: 0,
            backupCodes: updatedBackupCodes,
          }
        },
      })

      // Now perform login with special header to bypass 2FA check
      const headers = new Headers()
      headers.set('x-2fa-verified', 'true')
      
      // Create a new request object with the special header
      const newReq = {
        ...req,
        headers: {
          ...req.headers,
          get: (name: string) => {
            if (name === 'x-2fa-verified') return 'true'
            return req.headers.get(name)
          }
        }
      }

      const loginResult = await req.payload.login({
        collection: 'users',
        data: { email, password },
        req: newReq
      })

      return Response.json({
        success: true,
        user: loginResult.user,
        token: loginResult.token,
        exp: loginResult.exp,
        remainingBackupCodes: (isBackupCode || backupCode) ? 
          updatedBackupCodes?.filter(code => !code.used).length : undefined
      })

    } else {
      // Increment failure count
      const newFailureCount = (user.twoFactorAuth?.failureCount || 0) + 1
      
      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: {
          twoFactorAuth: {
            ...user.twoFactorAuth,
            failureCount: newFailureCount,
            lastFailureTime: new Date().toISOString(),
          }
        },
      })

      return Response.json({
        error: 'קוד אימות דו-שלבי שגוי',
        attemptsRemaining: Math.max(0, 5 - newFailureCount)
      }, { status: 401 })
    }

  } catch (error) {
    req.payload.logger.error('Login with 2FA error:', error)
    return Response.json(
      { error: 'שגיאה בהתחברות למערכת' }, 
      { status: 500 }
    )
  }
}

export default LoginWith2FAEndpoint