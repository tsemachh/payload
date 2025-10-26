import type { CollectionConfig } from 'payload'
import CheckAdminNotificationsEndPoint from './endpoints/CheckAdminNotificationsEndPoint'
import SendAdminMailNotificationsEndpoint from './endpoints/SendAdminMailNotificationsEndpoint'
import { IconLinkProps } from '@/admincomponents/link/IconLinkProps'
import { adminNotificationTypeOptions } from './typeOptions'

const NotificationLinkProps: IconLinkProps = {
  urlTemplate: '${value}',
  iconUrl: '/link.ico',
  iconAltText: 'קישור',
  iconOnly: true,
}

export const AdminNotifications: CollectionConfig = {
  slug: 'admin-notifications',
  labels: {
    plural: 'התראות',
    singular: 'התראה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'message',
    group: 'פעילות',
    defaultColumns: ['message', 'url', 'handled', 'createdAt', 'assignee', 'acquireTask'],
    components: {
      beforeListTable: ['/collections/admin-notifications/components/TaskMenu'],
    },
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  defaultSort: '-createdAt',
  custom: {
    filterList: [['type', 'createdAt', 'meetingDate', 'holdingsLimit', 'handled', 'acquireTask']],
    defaultFilter: { handled: { equals: false }, type: { equals: 'newVoteAfterHoldingLimit' } },
  },
  fields: [
    {
      name: 'message',
      label: 'הודעה',
      type: 'text',
      required: true,
      admin: {
        custom: {
          cellWidth: '400px',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: 'סוג התראה',
          type: 'select',
          interfaceName: 'AdminNotificationType',
          options: adminNotificationTypeOptions as any,
          admin: {
            width: '200px',
          },
        },
        {
          name: 'assignee',
          label: 'אחראי',
          type: 'relationship',
          relationTo: 'users',
          hasMany: false,
          admin: {
            allowCreate: false,
            width: '300px',
          },
          filterOptions: {
            isAdmin: { equals: true },
          },
        },
        {
          name: 'url',
          label: 'קישור',
          type: 'text',
          admin: {
            components: {
              Cell: {
                path: '/admincomponents/link/TableLinkCell',
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
          admin: {
            components: {
              Cell: {
                path: '/admincomponents/cell/EditableCheckboxCell',
              },
            },
          },
        },
      ],
    },

    {
      name: 'acquireTask',
      label: 'פעולות',
      type: 'text',
      virtual: true,
      admin: {
        condition: (_, siblingData) => siblingData.assignee !== null,
        hidden: true,
        components: {
          Cell: {
            path: '/collections/admin-notifications/components/AcquireTaskCell',
          },
        },
      },
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
