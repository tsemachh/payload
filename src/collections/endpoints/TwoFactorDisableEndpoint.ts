import { addDataAndFileToRequest, PayloadRequest } from 'payload'

/**
 * Endpoint to disable 2FA for a user
 * Path: /api/users/2fa-disable
 * Method: POST
 */
const TwoFactorDisableEndpoint = async (req: PayloadRequest) => {
  try {
    await addDataAndFileToRequest(req)

    const { currentPassword } = (await req.json?.()) || {}

    if (!currentPassword) {
      return Response.json({ error: 'נדרשת סיסמה נוכחית' }, { status: 400 })
    }

    if (!req.user) {
      return Response.json({ error: 'לא מאומת' }, { status: 401 })
    }

    // Verify current password by attempting login
    try {
      await req.payload.login({
        collection: 'users',
        data: {
          email: req.user.email,
          password: currentPassword,
        },
      })
    } catch (error) {
      return Response.json({ error: 'סיסמה שגויה' }, { status: 400 })
    }

    // Disable 2FA
    await req.payload.update({
      collection: 'users',
      id: req.user.id,
      req: {
        ...req,
        context: { ...req.context, process: 'disableTwoFactor' },
      },
      data: {
        twoFactorAuth: {
          enabled: false,
          verified: false,
          secret: null,
          backupCodes: [],
          lastUsed: null,
          failureCount: 0,
        },
      },
    })

    return Response.json({
      success: true,
      message: 'אימות דו-שלבי בוטל בהצלחה',
    })
  } catch (error) {
    req.payload.logger.error({ error }, '2FA disable error:')
    return Response.json({ error: 'שגיאה בביטול אימות דו-שלבי' }, { status: 500 })
  }
}

export default TwoFactorDisableEndpoint
