import type { CollectionConfig } from 'payload'

export const MeetingsFeed: CollectionConfig = {
  slug: 'meetings-feed',
  labels: {
    plural: 'הזנות אסיפות',
    singular: 'הזנת אסיפות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
  },
  custom: {
    filterList: [
      [{ name:'createdAt'}]
    ],
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
      type: 'textarea',
      admin: {
        readOnly: true,
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
  ],
  upload: { skipSafeFetch: true },
}
