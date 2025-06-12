import type { CollectionConfig } from 'payload'
import { processMeetingsFeedCsv } from './processMeetingsFeedCsv'

export const MeetingsFeed: CollectionConfig = {
  slug: 'meetings-feed',
  labels: {
    plural: 'קבצי  אסיפות',
    singular: 'קובץ אסיפות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'comments',
      type: 'textarea',
      label: 'הערות',
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
            if (siblingData.hash) return siblingData.hash;
            return undefined;
          },
        ],
      },
    },
  ],
  upload: true,
}
