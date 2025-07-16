import type { CollectionConfig } from 'payload'
import MarkReadEndpoint from './endpoints/MarkReadEndpoint'
import MarkAllReadEndpoint from './endpoints/MarkAllReadEndpoint'
import UserNotificationsEndpoint from './endpoints/UserNotificationsEndpoint'
import  SendCompanyMeetingNotificationsEndpoint  from './endpoints/SendCompanyMeetingNotificationsEndpoint'
import { CheckCompanyNotificationsEndpoint } from './endpoints/CheckCompanyNotificationsEndpoint'

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
  custom: {
    filterList: [
      [{ name: 'createdAt' }, { name: 'notificationType' }, { name: 'readStatus' }]
    ],
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
      filterOptions: ({ req }: any) => {
        if (req.context?.from == 'migration' || req.context?.from == 'process') {
          return true
        }
        return {
          type: { equals: 'regular' },
        }
      },
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
    {
      path: '/send-notifications',
      method: 'post',
      handler: SendCompanyMeetingNotificationsEndpoint,
    },
    {
      path: '/check-notifications',
      method: 'post',
      handler: CheckCompanyNotificationsEndpoint,
    },
  ],
}
