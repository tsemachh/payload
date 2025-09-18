import type { Endpoint } from 'payload'
import { 
  generateTOTPSecret, 
  generateQRCode, 
  generateBackupCodes,
  encryptTOTPSecret 
} from '@/utils/totpUtils'

export const twoFactorSetupEndpoint: Endpoint = {
  path: '/auth/2fa/setup',
  method: 'post',
  handler: async (req) => {
    try {
      if (!req.user) {
        return Response.json({ error: 'לא מאומת' }, { status: 401 })
      }

      // Check if 2FA is already enabled
      if (req.user.twoFactorAuth?.enabled && req.user.twoFactorAuth?.verified) {
        return Response.json({ error: 'אימות דו-שלבי כבר מופעל' }, { status: 400 })
      }

      // Generate TOTP secret
      const totpSecret = generateTOTPSecret(req.user.email, 'EMDA')
      
      // Generate QR code
      const qrCodeDataUrl = await generateQRCode(totpSecret.qrCodeUrl)
      
      // Generate backup codes
      const backupCodes = generateBackupCodes(10)
      
      // Encrypt the secret before storing
      const encryptedSecret = encryptTOTPSecret(totpSecret.secret)
      
      // Update user with TOTP data (but don't enable yet - wait for verification)
      await req.payload.update({
        collection: 'users',
        id: req.user.id,
        data: {
          twoFactorAuth: {
            enabled: false, // Will be enabled after verification
            verified: false,
            secret: encryptedSecret,
            backupCodes,
            failureCount: 0,
          },
        },
      })

      return Response.json({
        success: true,
        qrCode: qrCodeDataUrl,
        manualEntryKey: totpSecret.manualEntryKey,
        backupCodes: backupCodes.map(code => code.code), // Only return codes for display
      })

    } catch (error) {
      req.payload.logger.error('2FA setup error:', error)
      return Response.json(
        { error: 'שגיאה בהגדרת אימות דו-שלבי' }, 
        { status: 500 }
      )
    }
  },
}