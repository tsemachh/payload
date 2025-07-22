import { cookies } from 'next/headers'
import {
  CollectionConfig,
  CollectionSlug,
  type Endpoint,
  generatePayloadCookie,
  getFieldsToSign, IncomingAuthType,
  jwtSign,
} from 'payload'
import { PluginTypes } from '../index'
import type { SanitizedCollectionConfig } from 'payload'

export const unImpersonateEndpoint = (
  authCollectionSlug: string,
  pluginOptions: PluginTypes,
): Endpoint => ({
  handler: async (req) => {
    const { payload, routeParams } = req
    const appCookies = await cookies()

    if (!routeParams?.id) {
      return new Response('No user ID provided', { status: 400 })
    }
    const authCollection = payload.config.collections?.find(
      (collection) => collection.slug === authCollectionSlug,
    ) as CollectionConfig
    const auth:IncomingAuthType = authCollection?.auth as IncomingAuthType

    const isUseSessionsActive = auth?.useSessions === true

    const user = await payload.db.findOne<any>({
      collection: authCollectionSlug as CollectionSlug,
      req,
      where: { id: { equals: routeParams.id as string } },
    })

    if (!user) {
      return new Response('User not found', { status: 404 })
    }

    const fieldsToSignArgs: Parameters<typeof getFieldsToSign>[0] = {
      collectionConfig: authCollection as CollectionConfig,
      email: user.email!,
      user,
    }

    if (isUseSessionsActive) {
      fieldsToSignArgs.sid = user.sessions![0].id
    }

    const fieldsToSign = getFieldsToSign(fieldsToSignArgs)

    const { token } = await jwtSign({
      fieldsToSign,
      secret: payload.secret,
      tokenExpiration: auth.tokenExpiration!,
    })

    const cookie = generatePayloadCookie({
      collectionAuthConfig: auth! as  SanitizedCollectionConfig['auth'],
      cookiePrefix: payload.config.cookiePrefix,
      token,
    })

    // Clean up impersonate cookies
    appCookies.delete('impersonate')
    appCookies.delete('impersonate_target')

    // Call onUnImpersonate callback if provided
    if (pluginOptions.onUnImpersonate) {
      await pluginOptions.onUnImpersonate({ req, originalUserId: user.id })
    }

    return new Response(null, {
      headers: {
        'Set-Cookie': cookie,
        Location: '/admin',
      },
      status: 302,
    })
  },
  method: 'get',
  path: '/unImpersonate/:id',
})
