import type { CollectionConfig } from 'payload'

export const HoldingsFeed: CollectionConfig = {
  slug: 'holdings-feed',
  labels: {
    plural: 'קבצי אחזקות',
    singular: 'קובץ אחזקות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      // Processing is now done synchronously in the endpoint
    ],
  },
  fields: [
    {
      name: 'valueDate',
      label: 'תאריך ערך',
      type: 'date',
      required: true,
      admin: {
        date: {
          displayFormat: 'dd MMM yyy',
          pickerAppearance: 'default',
        },
      },
    },
    {
      name: 'comments',
      type: 'text',
      label: 'הערות',
    },
    {
      name: 'selectedCompanies',
      label: 'חברות שנבחרו',
      type: 'relationship',
      hasMany: true,
      relationTo: 'companies',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'processingStatus',
      type: 'select',
      label: 'סטטוס עיבוד',
      admin: {
        readOnly: true,
      },
      options: [
        { label: 'ממתין לעיבוד', value: 'pending' },
        { label: 'הושלם בהצלחה', value: 'completed' },
        { label: 'נכשל', value: 'failed' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'processingErrors',
      type: 'array',
      label: 'שגיאות עיבוד',
      admin: {
        readOnly: true,
      },
      fields: [
        {
          type: 'group',
          name: 'line',
          interfaceName: 'HoldingFeedLine',
          fields: [
            {
              name: 'error',
              type: 'text',
              label: 'שגיאה',
            },
            {
              name: 'stockId',
              type: 'text',
              label: 'מזהה נייר ערך',
            },
            {
              name: 'accountId',
              type: 'text',
              label: 'מזהה חשבון',
            },
            {
              name: 'quantity',
              type: 'number',
              label: 'כמות',
            },
            {
              name: 'lineNumber',
              type: 'number',
              label: 'מספר שורה',
            },
            {
              name: 'status',
              type: 'select',
              options: ['error','success']
            }
          ],
        },
      ],
    },
    {
      name: 'accountsJson',
      type: 'text',
      label: 'חשבונות בפיד (JSON)',
      admin: {
        readOnly: true,
      },
    },
  ],
  upload: true,
}
