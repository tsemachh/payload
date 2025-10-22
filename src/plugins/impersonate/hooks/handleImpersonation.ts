import { PayloadRequest } from 'payload'
import { createImpersonationNotifications } from './createImpersonationNotifications'
import { logImpersonationStart, logImpersonationEnd } from './logImpersonationEvents'

interface HandleImpersonationStartParams {
  req: PayloadRequest
  impersonateUserId: string
}

interface HandleImpersonationEndParams {
  req: PayloadRequest
  originalUserId: string
}

export const handleImpersonationStart = async ({
  req,
  impersonateUserId,
}: HandleImpersonationStartParams) => {
  const { user: originalUser } = req

  // Log impersonation action
  logImpersonationStart({ originalUser, impersonateUserId, req })

  // Get the target user details for the notification
  try {
    const targetUser = await req.payload.findByID({
      collection: 'users',
      id: impersonateUserId,
    })

    // Create notifications
    await createImpersonationNotifications({
      req,
      originalUser,
      targetUser,
      impersonateUserId,
    })
  } catch (error) {
    console.error('Error handling impersonation start:', error)
  }
}

export const handleImpersonationEnd = async ({
  req,
  originalUserId,
}: HandleImpersonationEndParams) => {
  logImpersonationEnd({ originalUserId, req })
}
