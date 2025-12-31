import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { generateBackupCodes } from '@/utils/totpUtils'

/**
 * Endpoint to regenerate backup codes or get 2FA status
 * Path: /api/users/2fa-backup-codes
 * Method: POST (regenerate) / GET (status)
 */
const TwoFactorBackupCodesEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      return Response.json({ error: 'לא מאומת' }, { status: 401 })
    }

    // GET request - return 2FA status
    if (req.method === 'GET') {
      if (!req.user.twoFactorAuth?.enabled) {
        return Response.json({
          twoFactorEnabled: false,
          remainingCodes: 0,
        })
      }

      const remainingCodes =
        req.user.twoFactorAuth.backupCodes?.filter((code: any) => !code.used).length || 0

      return Response.json({
        twoFactorEnabled: true,
        verified: req.user.twoFactorAuth.verified,
        remainingCodes,
        lastUsed: req.user.twoFactorAuth.lastUsed,
      })
    }

    // POST request - regenerate backup codes
    if (req.method === 'POST') {
      // Check if 2FA is enabled
      if (!req.user.twoFactorAuth?.enabled || !req.user.twoFactorAuth?.verified) {
        return Response.json({ error: 'אימות דו-שלבי לא מופעל' }, { status: 400 })
      }

      // Generate new backup codes
      const newBackupCodes = generateBackupCodes(10)

      // Update user with new backup codes
      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        req: {
          ...req,
          context: { ...req.context, process: 'generateTwoFactorBackupCodes' },
        },
        data: {
          twoFactorAuth: {
            ...req.user.twoFactorAuth,
            backupCodes: newBackupCodes,
          },
        },
      })

      return Response.json({
        success: true,
        backupCodes: newBackupCodes.map((code) => code.code),
        message: 'קודי גיבוי חדשים נוצרו בהצלחה',
      })
    }

    return Response.json({ error: 'שיטה לא נתמכת' }, { status: 405 })
  } catch (error: any) {
    req.payload.logger.error('2FA backup codes error:', error)
    return Response.json({ error: 'שגיאה בטיפול בקודי גיבוי' }, { status: 500 })
  }
}

export default TwoFactorBackupCodesEndpoint
