import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/utils/authUtils'

export const MeetingsFeed: CollectionConfig = {
  slug: 'meetings-feed',
  labels: {
    plural: 'הזנות אסיפות',
    singular: 'הזנת אסיפות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
    defaultColumns: ['filename', 'createdAt', 'summary', 'duration', 'comments', 'meetings'],
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
      label: 'אסיפות',
      name: 'meetings',
      type: 'relationship',
      hasMany: true,
      relationTo: 'meetings',
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
