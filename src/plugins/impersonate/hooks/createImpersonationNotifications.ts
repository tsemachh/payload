import { PayloadRequest } from 'payload'

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
}: CreateImpersonationNotificationsParams) => {
  try {
    // Use bidi control characters to ensure correct RTL rendering with LTR emails/names
    const RLE = '\u202B' // Right-to-Left Embedding

    const originalLabel = originalUser?.email || originalUser?.name || 'לא ידוע'
    const targetLabel = targetUser?.email || targetUser?.name || 'לא ידוע'
    const message = `${RLE}מנהל ${originalLabel} התחזה למשתמש ${targetLabel}`

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
            req,
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
