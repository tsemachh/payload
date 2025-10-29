import { addDataAndFileToRequest, PayloadRequest } from 'payload'
import { 
  generateTOTPSecret, 
  generateQRCode, 
  generateBackupCodes,
  encryptTOTPSecret 
} from '@/utils/totpUtils'

/**
 * Endpoint to setup 2FA for a user
 * Path: /api/users/2fa-setup
 * Method: POST
 */
const TwoFactorSetupEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

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
    
    // Update user with TOTP data (preserve enabled status if already set by admin)
    const currentEnabled = req.user.twoFactorAuth?.enabled || false

    await req.payload.update({
      collection: 'users',
      id: req.user.id,
      data: {
        twoFactorAuth: {
          enabled: currentEnabled, // Preserve current enabled status
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
    req.payload.logger.error({ error }, '2FA setup error:')
    return Response.json(
      { error: 'שגיאה בהגדרת אימות דו-שלבי' }, 
      { status: 500 }
    )
  }
}

export default TwoFactorSetupEndpoint