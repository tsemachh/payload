import { v4 as uuid } from 'uuid'
import { cookies } from 'next/headers'
import {
  CollectionConfig,
  CollectionSlug,
  type Endpoint,
  generatePayloadCookie,
  getFieldsToSign,
  jwtSign,
  TypedUser,
} from 'payload'
import { PluginTypes } from '../index'
import type { SanitizedCollectionConfig } from 'payload'

export const impersonateEndpoint = (
  authCollectionSlug: string,
  pluginOptions: PluginTypes,
): Endpoint => ({
  method: 'get',
  path: '/:id/impersonate',
  handler: async (req) => {
    const { payload, routeParams } = req

    const authCollection = payload.config.collections?.find(
      (collection) => collection.slug === authCollectionSlug,
    )
    const isUseSessionsActive = authCollection?.auth?.useSessions === true

    const appCookies = await cookies()
    if (!routeParams?.id) {
      return new Response('No user ID provided', { status: 400 })
    }

    const user = await payload.db.findOne<any>({
      collection: authCollectionSlug as CollectionSlug,
      req,
      where: {id:{equals: routeParams.id as string}},
    })


    if (!user) {
      return new Response('User not found', { status: 404 })
    }

    const fieldsToSignArgs: Parameters<typeof getFieldsToSign>[0] = {
      collectionConfig: authCollection as CollectionConfig,
      email: (user as unknown as TypedUser).email!,
      user: user as TypedUser,
    }

    if (isUseSessionsActive) {
      const newSessionID = uuid()
      const now = new Date()
      const tokenExpInMs = authCollection.auth.tokenExpiration * 1000
      const expiresAt = new Date(now.getTime() + tokenExpInMs)

      const session = { id: newSessionID, createdAt: now, expiresAt }

      if (!user.sessions?.length) {
        user.sessions = [session]
      } else {
        user.sessions.push(session)
      }

      await payload.db.updateOne({
        id: user.id,
        collection: authCollectionSlug as CollectionSlug,
        data: user,
        req,
        returning: false,
      })

      fieldsToSignArgs.sid = newSessionID
    }

    const fieldsToSign = getFieldsToSign(fieldsToSignArgs)

    const { token } = await jwtSign({
      fieldsToSign,
      secret: payload.secret,
      tokenExpiration: authCollection?.auth.tokenExpiration as number,
    })

    const cookie = generatePayloadCookie({
      collectionAuthConfig: authCollection?.auth as SanitizedCollectionConfig['auth'] ,
      cookiePrefix: payload.config.cookiePrefix,
      token,
    })

    // Set impersonate cookie with original user ID
    appCookies.set('impersonate', req.user?.id.toString() as string)
    appCookies.set('impersonate_target', user.id.toString())

    // Call onImpersonate callback if provided
    if (pluginOptions.onImpersonate) {
      await pluginOptions.onImpersonate({ req, impersonateUserId: user.id })
    }

    return new Response(null, {
      headers: {
        'Set-Cookie': cookie,
        Location: '/',
      },
      status: 302,
    })
  },
})
