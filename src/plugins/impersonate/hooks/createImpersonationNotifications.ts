import { PayloadRequest } from 'payload'
import { createAdminNotification } from '@/utils/utils'

interface CreateImpersonationNotificationsParams {
  req: PayloadRequest
  originalUser: any
  targetUser: any
  impersonateUserId: string
}

export const createImpersonationNotifications = async ({
  req,
  originalUser,
  targetUser,
  impersonateUserId,
}: CreateImpersonationNotificationsParams) => {
  try {
    const message = `מנהל ${originalUser?.email || originalUser?.name || 'לא ידוע'} התחזה למשתמש ${targetUser?.email || targetUser?.name || 'לא ידוע'}`

    // Create admin notification
    await createAdminNotification(
      req.payload,
      message,
      'userImpersonation',
      `/admin/collections/users/${impersonateUserId}`,
      undefined,
      impersonateUserId as string,
    )

    // Create company-meeting-notifications for all target user's companies
    if (targetUser?.companies && Array.isArray(targetUser.companies)) {
      for (const userCompany of targetUser.companies) {
        if (userCompany?.companyId) {
          await req.payload.create({
            collection: 'company-meeting-notifications',
            data: {
              message,
              notificationType: 'user-impersonation',
              company: userCompany.companyId,
            },
          })
        }
      }

      console.log(`Created ${targetUser.companies.length} company notifications for impersonation`)
    }
  } catch (error) {
    console.error('Error creating impersonation notification:', error)
    throw error
  }
}
