import type { CollectionConfig } from 'payload'
import { isUserCompanyHoldingFeed } from '@/utils/authUtils'

export const HoldingsFeed: CollectionConfig = {
  slug: 'holdings-feed',
  labels: {
    plural: 'הזנות החזקות',
    singular: 'הזנת החזקות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'תחזוקה',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  access: {
    create: isUserCompanyHoldingFeed,
    read: isUserCompanyHoldingFeed,
    update: isUserCompanyHoldingFeed,
    delete: isUserCompanyHoldingFeed,
  },
  custom: {
    filterList: [[{ name: 'valueDate' }, { name: 'processingStatus' }]],
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
      index: true,
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
      index: true,
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
      name: 'processingResults',
      type: 'array',
      label: 'תוצאות עיבוד',
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
              options: ['error', 'success', 'silenced'],
            },
          ],
        },
      ],
    },
  ],
  upload: { skipSafeFetch: true },
}
