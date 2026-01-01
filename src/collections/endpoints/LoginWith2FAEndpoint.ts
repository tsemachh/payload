import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import {
  verifyTOTPToken,
  verifyBackupCode,
  decryptTOTPSecret,
  checkRateLimit,
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
      isBackupCode = false,
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
        return Response.json(
          {
            error: error.message || 'אימייל או סיסמה שגויים',
          },
          { status: 401 },
        )
      }
    }

    // Step 2: If no 2FA required, perform the actual login
    if (!requiresTwoFactor) {
      // Use Payload's native login which handles cookies properly
      try {
        const loginResult = await req.payload.login({
          collection: 'users',
          data: { email, password },
          req, // Pass the request so cookies are set properly
        })

        // Return success with user data - cookies are automatically set by Payload
        return new Response(
          JSON.stringify({
            success: true,
            user: loginResult.user,
            token: loginResult.token,
            exp: loginResult.exp,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              // Let Payload's built-in auth cookies be set automatically
            },
          },
        )
      } catch (error) {
        return Response.json({ error: 'שגיאה בהתחברות' }, { status: 401 })
      }
    }

    // Step 3: 2FA is required - check if code is provided
    if (!totpCode && !backupCode) {
      return Response.json(
        {
          requires2FA: true,
          message: 'נדרש קוד אימות דו-שלבי',
        },
        { status: 200 },
      )
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
      user.twoFactorAuth?.lastFailureTime
        ? new Date(user.twoFactorAuth.lastFailureTime)
        : undefined,
    )

    if (rateLimitCheck.isLocked) {
      return Response.json(
        {
          error: `חשבון נחסם זמנית. נסה שוב בעוד ${rateLimitCheck.remainingTime} דקות`,
        },
        { status: 429 },
      )
    }

    // Verify 2FA code
    let isValid = false
    let updatedBackupCodes = user.twoFactorAuth?.backupCodes

    try {
      if (isBackupCode || backupCode) {
        // Verify backup code
        const backupCodes = (user.twoFactorAuth?.backupCodes || []).map((code) => ({
          code: code.code || '',
          used: code.used || false,
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
    } catch (error: any) {
      req.payload.logger.error('2FA verification error during login:', error)
      return Response.json({ error: 'שגיאה באימות הקוד' }, { status: 500 })
    }

    if (isValid) {
      // Update user with successful 2FA verification
      await req.payload.update({
        collection: 'users',
        id: user.id,
        req: {
          ...req,
          context: { ...req.context, from: 'process', process: 'LoginWith2FAEndpoint' },
        },
        data: {
          twoFactorAuth: {
            ...user.twoFactorAuth,
            lastUsed: new Date().toISOString(),
            failureCount: 0,
            backupCodes: updatedBackupCodes,
          },
        },
      })

      req.payload.logger.info(
        `2FA verification successful, attempting login for user: ${user.email}`,
      )

      // Now perform login with context flag to bypass 2FA check
      // Set a context flag that the beforeLogin hook can check
      req.context = { ...req.context, '2fa-verified': true }

      req.payload.logger.info(`Context set for 2FA bypass: ${JSON.stringify(req.context)}`)

      try {
        const loginResult = await req.payload.login({
          collection: 'users',
          data: { email, password },
          req, // Pass the original request so cookies are set properly
        })

        req.payload.logger.info(`Login successful, user authenticated: ${loginResult.user.email}`)
        req.payload.logger.info(`Login result token: ${loginResult.token ? 'Present' : 'Missing'}`)

        // Return exactly the same format as the working non-2FA case
        return new Response(
          JSON.stringify({
            success: true,
            user: loginResult.user,
            token: loginResult.token,
            exp: loginResult.exp,
            remainingBackupCodes:
              isBackupCode || backupCode
                ? updatedBackupCodes?.filter((code) => !code.used).length
                : undefined,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              // Let Payload's built-in auth cookies be set automatically
            },
          },
        )
      } catch (loginError) {
        req.payload.logger.error(`Login failed after 2FA verification: ${loginError}`)
        return Response.json({ error: 'שגיאה בהתחברות אחרי אימות דו-שלבי' }, { status: 500 })
      }
    } else {
      // Increment failure count
      const newFailureCount = (user.twoFactorAuth?.failureCount || 0) + 1

      await req.payload.update({
        collection: 'users',
        id: user.id,
        req: {
          ...req,
          context: {
            ...req.context,
            from: 'process',
            process: 'LoginWith2FAEndpoint.IncrementFailureCount',
          },
        },
        data: {
          twoFactorAuth: {
            ...user.twoFactorAuth,
            failureCount: newFailureCount,
            lastFailureTime: new Date().toISOString(),
          },
        },
      })

      return Response.json(
        {
          error: 'קוד אימות דו-שלבי שגוי',
          attemptsRemaining: Math.max(0, 5 - newFailureCount),
        },
        { status: 401 },
      )
    }
  } catch (error: any) {
    req.payload.logger.error('Login with 2FA error:', error)
    return Response.json({ error: 'שגיאה בהתחברות למערכת' }, { status: 500 })
  }
}

export default LoginWith2FAEndpoint
