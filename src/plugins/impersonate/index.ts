import type { CollectionConfig, Config, FieldAccess, PayloadRequest, Plugin, TypedUser } from 'payload'
import { cookies } from 'next/headers'
import { impersonateEndpoint } from './endpoints/impersonateEndpoint'
import { unImpersonateEndpoint } from './endpoints/unImpersonateEndpoint'
import { statusEndpoint } from './endpoints/statusEndpoint'
import { PLUGIN_LABELS } from './labels'

export const isAdminFieldLevel: FieldAccess<{ id: string }, TypedUser
> = ({ req: { user } }) => {
  // Return true or false based on if the user has an admin role
  return Boolean(user?.isAdmin);
};

export interface PluginTypes {
  /**
   * Slug of the collection where user information will be stored
   * @default "users"
   */
  authCollection?: string
  /**
   * Enable or disable plugin
   * @default false
   */
  enabled?: boolean
  /**
   * Optional callback that runs whenever an admin starts masquerading as another user.
   */
  onImpersonate?: ({
    req,
    impersonateUserId,
  }: {
    req: PayloadRequest
    impersonateUserId: string | number
  }) => void | Promise<void>
  /**
   * Optional callback that runs whenever an admin stops masquerading and returns to their original user.
   */
  onUnImpersonate?: ({
    req,
    originalUserId,
  }: {
    req: PayloadRequest
    originalUserId: string | number
  }) => void | Promise<void>
}

export const impersonatePlugin =
  (pluginOptions: PluginTypes): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }

    if (pluginOptions.enabled === false) {
      return config
    }

    // Use centralized labels
    const labels = { ...PLUGIN_LABELS }

    // Get current locale or default to 'en'
    const getCurrentLocaleLabels = (locale: 'en' | 'he' = 'en') => {
      return labels[locale] || labels.en || PLUGIN_LABELS.en
    }
    const authCollectionSlug = pluginOptions.authCollection || 'users'

    config.admin = {
      ...(config.admin || {}),
      components: {
        ...(config.admin?.components || {}),
        header: [
          ...(config.admin?.components?.header || []),
          {
            path: '@/plugins/impersonate/ui/UnImpersonate#UnImpersonate',
            clientProps: {
              authCollection: authCollectionSlug
            }
          },
        ],
        actions: [
          ...(config.admin?.components?.actions || []),
        ],
      },
    }

    const authCollection = config.collections?.find(
      (collection) => collection.slug === authCollectionSlug,
    )

    if (!authCollection) {
      throw new Error(`The collection with the slug "${authCollectionSlug}" was not found.`)
    }

    const modifiedCollection: CollectionConfig = {
      ...authCollection,
      endpoints: [
        ...(authCollection.endpoints || []),
        impersonateEndpoint(authCollectionSlug, pluginOptions),
        unImpersonateEndpoint(authCollectionSlug, pluginOptions),
        statusEndpoint(authCollectionSlug),
      ],
      fields: [
        ...(authCollection.fields || []),
        {
          name: 'impersonate',
          type: 'text',
          virtual: true,
          access:{
            read: isAdminFieldLevel
          },
          admin: {
            components: {
              Cell: {
                path: '@/plugins/impersonate/ui/ImpersonateCell#ImpersonateCell',
                clientProps: {
                  authCollection: authCollectionSlug
                }
              },
              Field: '@/plugins/impersonate/ui/NullField#NullField',
            },
          },
          label: {
            en: getCurrentLocaleLabels('en').impersonate as string,
            he: getCurrentLocaleLabels('he').impersonate as string,
          },
        },
      ],
      hooks: {
        ...(authCollection.hooks || []),
        afterLogout: [
          ...(authCollection.hooks?.afterLogout || []),
          async () => {
            const cooks = await cookies()
            cooks.delete('impersonate')
          },
        ],
      },
    }

    config.collections = (config.collections || []).map((collection) =>
      collection.slug === authCollectionSlug ? modifiedCollection : collection,
    )

    return config
  }
