import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/utils/authUtils'

export const StocksFeed: CollectionConfig = {
  slug: 'stocks-feed',
  labels: {
    plural: 'הזנות ניירות ערך',
    singular: 'הזנת ניירות ערך',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [[{ name: 'createdAt' }]],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'comments',
      type: 'json',
      label: 'הערות',
      admin: {
        readOnly: true,
        components: {
          Cell: {
            path: '/admincomponents/cell/FormattedErrorsCell',
          },
        },
      },
    },
    {
      name: 'hash',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // Don't modify the hash if it's already set
            if (siblingData.hash) return siblingData.hash
            return undefined
          },
        ],
      },
    },
    {
      name: 'duration',
      label: 'זמן התהליך',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'summary',
      label: 'סיכום',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
  ],

  upload: { skipSafeFetch: true },
}
