import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import crypto from 'crypto'

export interface TOTPSecret {
  secret: string
  qrCodeUrl: string
  manualEntryKey: string
}

export interface BackupCode {
  code: string
  used: boolean
}

/**
 * Generate a new TOTP secret for a user
 */
export function generateTOTPSecret(userEmail: string, serviceName: string = 'EMDA'): TOTPSecret {
  const secret = speakeasy.generateSecret({
    name: userEmail,
    issuer: serviceName,
    length: 32,
  })

  return {
    secret: secret.base32,
    qrCodeUrl: secret.otpauth_url || '',
    manualEntryKey: secret.base32,
  }
}

/**
 * Generate QR code as data URL for TOTP setup
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    })
    return qrCodeDataUrl
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + (error as Error).message)
  }
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTOTPToken(token: string, secret: string, window: number = 1): boolean {
  if (!token || !secret) {
    return false
  }

  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: token.replace(/\s/g, ''), // Remove any spaces
      window, // Allow some time drift (1 = 30 seconds before/after)
    })

    return verified
  } catch (error) {
    console.error('TOTP verification error:', error)
    return false
  }
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 10): BackupCode[] {
  const codes: BackupCode[] = []

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push({
      code,
      used: false,
    })
  }

  return codes
}

/**
 * Verify a backup code and mark it as used
 */
export function verifyBackupCode(
  inputCode: string,
  backupCodes: BackupCode[]
): { isValid: boolean; updatedCodes: BackupCode[] } {
  if (!inputCode || !backupCodes || backupCodes.length === 0) {
    return { isValid: false, updatedCodes: backupCodes }
  }

  const cleanedInput = inputCode.replace(/\s/g, '').toUpperCase()
  const updatedCodes = backupCodes.map((code) => ({ ...code })) // Deep copy

  // Find matching unused code
  const matchingCodeIndex = updatedCodes.findIndex(
    (code) => code.code === cleanedInput && !code.used
  )

  if (matchingCodeIndex !== -1) {
    // Mark code as used
    updatedCodes[matchingCodeIndex].used = true
    return { isValid: true, updatedCodes }
  }

  return { isValid: false, updatedCodes: backupCodes }
}

/**
 * Encrypt sensitive 2FA data before storing in database
 */
export function encryptTOTPSecret(secret: string, encryptionKey?: string): string {
  if (!encryptionKey) {
    encryptionKey = process.env.TOTP_ENCRYPTION_KEY || process.env.PAYLOAD_SECRET || 'default-key'
  }

  const algorithm = 'aes-256-gcm'
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const cipher = crypto.createCipheriv(algorithm, key, iv)

  let encrypted = cipher.update(secret, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Return iv + authTag + encrypted data as base64
  return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64')
}

/**
 * Decrypt 2FA secret from database
 */
export function decryptTOTPSecret(encryptedData: string, encryptionKey?: string): string {
  if (!encryptionKey) {
    encryptionKey = process.env.TOTP_ENCRYPTION_KEY || process.env.PAYLOAD_SECRET || 'default-key'
  }

  try {
    const algorithm = 'aes-256-gcm'
    const buffer = Buffer.from(encryptedData, 'base64')

    const iv = buffer.subarray(0, 16)
    const authTag = buffer.subarray(16, 32)
    const encrypted = buffer.subarray(32).toString('hex')

    const key = crypto.scryptSync(encryptionKey, 'salt', 32)
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Failed to decrypt TOTP secret:', error)
    throw new Error('Failed to decrypt 2FA secret')
  }
}

/**
 * Check if 2FA should be required based on security settings
 */
export function shouldRequire2FA(user: Record<string, any>, adminPanel: boolean = false): boolean {
  // Require 2FA for admin users in admin panel
  if (adminPanel && user?.isAdmin) {
    return user?.twoFactorAuth?.enabled === true && user?.twoFactorAuth?.verified === true
  }

  // Require 2FA for regular users if enabled
  return user?.twoFactorAuth?.enabled === true && user?.twoFactorAuth?.verified === true
}

/**
 * Rate limiting for 2FA attempts
 */
export function checkRateLimit(
  failureCount: number,
  lastFailureTime?: Date,
  maxAttempts: number = 5,
  lockoutMinutes: number = 15
): { isLocked: boolean; remainingTime?: number } {
  if (!lastFailureTime || failureCount < maxAttempts) {
    return { isLocked: false }
  }

  const now = new Date()
  const timeSinceLastFailure = now.getTime() - new Date(lastFailureTime).getTime()
  const lockoutDuration = lockoutMinutes * 60 * 1000 // Convert to milliseconds

  if (timeSinceLastFailure < lockoutDuration) {
    const remainingTime = Math.ceil((lockoutDuration - timeSinceLastFailure) / (60 * 1000))
    return { isLocked: true, remainingTime }
  }

  return { isLocked: false }
}