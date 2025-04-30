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
      type: 'text',
      label: 'הערות',
    },
  ],
  upload: true,
}
