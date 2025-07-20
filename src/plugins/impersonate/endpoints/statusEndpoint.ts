import { cookies } from 'next/headers'
import { CollectionSlug, type Endpoint, TypedUser } from 'payload'

export const statusEndpoint = (authCollectionSlug: string): Endpoint => ({
  method: 'get',
  path: '/impersonate/status',
  handler: async (req) => {
    const { payload } = req
    const appCookies = await cookies()

    const impersonateUserId = appCookies.get('impersonate')?.value
    const targetUserId = appCookies.get('impersonate_target')?.value

    if (!impersonateUserId || !targetUserId) {
      return Response.json({
        isImpersonating: false,
      })
    }

    try {
      const [originalUser, currentUser] = await Promise.all([
        payload.findByID({
          collection: authCollectionSlug as CollectionSlug,
          id: impersonateUserId,
        }),
        payload.findByID({
          collection: authCollectionSlug as CollectionSlug,
          id: targetUserId,
        }),
      ])

      return Response.json({
        isImpersonating: true,
        originalUser: {
          id: originalUser.id,
          email: (originalUser as TypedUser).email,
        },
        currentUser: {
          id: currentUser.id,
          email: (currentUser as TypedUser).email,
        },
      })
    } catch (error) {
      console.warn('Failed to fetch impersonation status:', error)
      return Response.json({
        isImpersonating: false,
      })
    }
  },
})
