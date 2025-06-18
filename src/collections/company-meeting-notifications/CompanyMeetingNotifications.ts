import type { CollectionConfig } from 'payload'

export const CompanyMeetingNotifications: CollectionConfig = {
  slug: 'company-meeting-notifications',
  labels: {
    plural: 'התראות אסיפות חברה',
    singular: 'התראת אסיפת חברה',
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
      ],
      required: true,
    },
    {
      name: 'meeting',
      label: 'אסיפה',
      type: 'relationship',
      relationTo: 'meetings',
      required: true,
    },
    {
      name: 'company',
      label: 'חברה',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
  ],
}
