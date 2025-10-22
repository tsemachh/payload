import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { 
  verifyTOTPToken, 
  verifyBackupCode,
  decryptTOTPSecret,
  checkRateLimit 
} from '@/utils/totpUtils'

/**
 * Endpoint to verify 2FA code
 * Path: /api/users/2fa-verify
 * Method: POST
 */
const TwoFactorVerifyEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)
    
    const { token, isBackupCode = false, enableAfterVerification = false } = (await req.json?.()) || {}
    
    if (!token) {
      return Response.json({ error: 'נדרש קוד אימות' }, { status: 400 })
    }

    if (!req.user) {
      return Response.json({ error: 'לא מאומת' }, { status: 401 })
    }

    if (!req.user.twoFactorAuth?.secret) {
      return Response.json({ error: 'אימות דו-שלבי לא מוגדר - אנא בצע הגדרה תחילה' }, { status: 400 })
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(
      req.user.twoFactorAuth.failureCount || 0,
      req.user.twoFactorAuth.lastFailureTime ? new Date(req.user.twoFactorAuth.lastFailureTime) : undefined
    )
    
    if (rateLimitCheck.isLocked) {
      return Response.json({
        error: `חשבון נחסם זמנית. נסה שוב בעוד ${rateLimitCheck.remainingTime} דקות`
      }, { status: 429 })
    }

    let isValid = false
    let updatedBackupCodes = req.user.twoFactorAuth.backupCodes

    try {
      if (isBackupCode) {
        // Verify backup code
        const backupCodes = (req.user.twoFactorAuth.backupCodes || []).map(code => ({
          code: code.code || '',
          used: code.used || false
        }))
        const backupResult = verifyBackupCode(token, backupCodes)
        isValid = backupResult.isValid
        updatedBackupCodes = backupResult.updatedCodes
      } else {
        // Verify TOTP token
        const decryptedSecret = decryptTOTPSecret(req.user.twoFactorAuth.secret)
        isValid = verifyTOTPToken(token, decryptedSecret)
      }
    } catch (error) {
      req.payload.logger.error('2FA verification error:', error)
      return Response.json({ error: 'שגיאה באימות הקוד' }, { status: 500 })
    }

    if (isValid) {
      // Reset failure count and update last used
      const updateData = {
        twoFactorAuth: {
          ...req.user.twoFactorAuth,
          lastUsed: new Date().toISOString(),
          failureCount: 0,
          backupCodes: updatedBackupCodes,
        }
      }

      // If this is the initial verification, enable and verify 2FA
      if (enableAfterVerification) {
        updateData.twoFactorAuth.enabled = true
        updateData.twoFactorAuth.verified = true
      } else if (req.user.twoFactorAuth.enabled && !req.user.twoFactorAuth.verified) {
        // If already enabled (e.g., by admin) but not verified, mark as verified
        updateData.twoFactorAuth.verified = true
      }

      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        data: updateData,
      })

      return Response.json({
        success: true,
        message: enableAfterVerification ? 'אימות דו-שלבי הופעל בהצלחה' : 'אומת בהצלחה',
        remainingBackupCodes: isBackupCode ? updatedBackupCodes?.filter(code => !code.used).length : undefined
      })

    } else {
      // Increment failure count
      const newFailureCount = (req.user.twoFactorAuth.failureCount || 0) + 1
      
      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        data: {
          twoFactorAuth: {
            ...req.user.twoFactorAuth,
            failureCount: newFailureCount,
            lastFailureTime: new Date().toISOString(),
          }
        },
      })

      return Response.json({
        error: 'קוד שגוי',
        attemptsRemaining: Math.max(0, 5 - newFailureCount)
      }, { status: 400 })
    }

  } catch (error) {
    req.payload.logger.error('2FA verification error:', error)
    return Response.json(
      { error: 'שגיאה באימות דו-שלבי' }, 
      { status: 500 }
    )
  }
}

export default TwoFactorVerifyEndpoint