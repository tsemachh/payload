import type { CollectionConfig } from 'payload'
import CheckAdminNotificationsEndPoint from './endpoints/CheckAdminNotificationsEndPoint'
import SendAdminMailNotificationsEndpoint from './endpoints/SendAdminMailNotificationsEndpoint'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'

const NotificationLinkProps: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico',
  iconAltText: 'קישור',
  iconOnly: true,
}

export const AdminNotifications: CollectionConfig = {
  slug: 'admin-notifications',
  labels: {
    plural: 'התראות מנהל',
    singular: 'התראת מנהל',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'message',
    group: 'ניהול',
    defaultColumns: [
      'message',
      'url',
      'handled',
      'type',
      'createdAt',
      'meeting',
      'stock',
      'meetingDate',
      'holdingsLimit',
    ],
  },
  defaultSort: 'createdAt',
  custom: {
    filterList: [['type', 'createdAt', 'meetingDate', 'holdingsLimit', 'handled']],
  },
  fields: [
    {
      name: 'message',
      label: 'הודעה',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      label: 'סוג התראה',
      type: 'select',
      interfaceName: 'AdminNotificationType',
      options: [
        {
          label: 'כללי',
          value: 'general',
        },
        {
          label: 'פיד מערכת',
          value: 'predictaFeed',
        },
        {
          label: 'משתמש חדש',
          value: 'userCreated',
        },
        {
          label: 'שינוי הרשאות משתמש',
          value: 'userPermissionsChanged',
        },
        {
          label: 'חברה לא דיווחה אחזקות',
          value: 'companyNotReportedHoldings',
        },
        {
          label: 'חברה לא הצביעה באסיפה',
          value: 'companyNotVotedMeetingNextDay',
        },
        {
          label: 'הצבעה חדשה לאחר מועד קובע',
          value: 'newVoteAfterHoldingLimit',
        },
        {
          label: 'התחזות למשתמש',
          value: 'userImpersonation',
        },
      ],
      defaultValue: 'general',
    },
    {
      name: 'url',
      label: 'קישור',
      type: 'text',
      admin: {
        components: {
          Cell: {
            path: '/admincomponents/link/IconLinkCell',
            clientProps: NotificationLinkProps,
          },
          Field: {
            path: '/admincomponents/link/IconLinkTextField',
            clientProps: NotificationLinkProps,
          },
        },
      },
    },
    {
      name: 'handled',
      label: 'טופל',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'companies',
          label: 'חברות קשורות',
          type: 'relationship',
          relationTo: 'companies',
          hasMany: true,
        },
        {
          name: 'meeting',
          label: 'אסיפה קשורה',
          type: 'relationship',
          relationTo: 'meetings',
          hasMany: false,
        },
        {
          name: 'meetingDate',
          label: 'מועד האסיפה',
          type: 'date',
          virtual: 'meeting.meetingDate',
        },
        {
          name: 'holdingsLimit',
          label: 'מועד קובע',
          type: 'date',
          virtual: 'meeting.holdingsLimit',
        },
        {
          name: 'stock',
          label: 'מניה',
          type: 'relationship',
          relationTo: 'stocks',
          virtual: 'meeting.stock',
        },
        {
          name: 'relatedUser',
          label: 'משתמש קשור',
          type: 'relationship',
          relationTo: 'users',
          hasMany: false,
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/check-notifications',
      method: 'post',
      handler: CheckAdminNotificationsEndPoint,
    },
    {
      path: '/send-mail-notifications',
      method: 'post',
      handler: SendAdminMailNotificationsEndpoint,
    },
  ],
}
