import type { CollectionConfig } from 'payload'
import MarkReadEndpoint from './endpoints/MarkReadEndpoint'
import MarkAllReadEndpoint from './endpoints/MarkAllReadEndpoint'
import UserNotificationsEndpoint from './endpoints/UserNotificationsEndpoint'

export const CompanyMeetingNotifications: CollectionConfig = {
  slug: 'company-meeting-notifications',
  labels: {
    plural: 'התראות משתמשים',
    singular: 'התראת משתמשים',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'message',
    group: 'ניהול',
  },
  fields: [
    {
      name: 'message',
      label: 'הודעה',
      type: 'text',
      required: true,
    },
    {
      name: 'notificationType',
      label: 'סוג התראה',
      type: 'select',
      interfaceName: 'UserNotificationType',
      options: [
        { label: 'יום אחרי מועד קובע', value: 'after-holding-limit' },
        { label: 'יום לפני סיום הצבעה', value: 'before-voting-end' },
        { label: 'אחזקות לא דווחו', value: 'holdings-not-fed' },
      ],
      required: true,
    },
    {
      name: 'readStatus',
      label: 'סטטוס קריאה',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'meeting',
      label: 'אסיפה',
      type: 'relationship',
      relationTo: 'meetings',
      required: false,
    },
    {
      name: 'company',
      label: 'חברה',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
  ],
  endpoints: [
    {
      path: '/mark-read/:id',
      method: 'post',
      handler: MarkReadEndpoint,
    },
    {
      path: '/mark-all-read',
      method: 'post',
      handler: MarkAllReadEndpoint,
    },
    {
      path: '/user-notifications',
      method: 'get',
      handler: UserNotificationsEndpoint,
    },
  ],
}
