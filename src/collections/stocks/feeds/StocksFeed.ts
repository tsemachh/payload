import type { CollectionConfig } from 'payload'

export const StocksFeed: CollectionConfig = {
  slug: 'stocks-feed',
  labels: {
    plural: 'הזנות מניות',
    singular: 'הזנת מניות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
  },
  custom: {
    filterList: [{ name:'createdAt'}],
  },
  access: {
    read: () => true,
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
