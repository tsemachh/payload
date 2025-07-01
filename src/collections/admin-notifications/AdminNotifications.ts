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
  },
  fields: [
    {
      name: 'message',
      label: 'הודעה',
      type: 'text',
      required: true,
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
      name: 'readStatus',
      label: 'סטטוס קריאה',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        components: {
          Cell: '/admincomponents/fields/ReadStatusField',
        },
      },
    },
    {
      name: 'relatedCompany',
      label: 'חברה קשורה',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: false,
    },
    {
      name: 'relatedUser',
      label: 'משתמש קשור',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
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
