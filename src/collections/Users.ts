import type { CollectionConfig } from 'payload'
import { userFields } from '@shefing/authorization'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'משתמשים',
    singular: 'משתמש',
  },
  admin: {
    useAsTitle: 'email',
    group: "ניהול",
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50,100,200,500],
    },
  },
  auth: {
    useAPIKey: true,
    tokenExpiration: (process.env.NODE_ENV == "production") ? 43200 : 432000 // 12 hours in prod, 5 days in dev timeout
  },
  fields: [
    {
      name: 'name',
      label: 'שם משתמש',
      type: 'text',
    },
    {
      name: 'active',
      label: 'משתמש פעיל',
      type: 'checkbox',
      index: true
    },
    {
      name: 'userType',
      label: 'סוג משתמש',
      type: 'select',
      interfaceName: 'UserType',
      options: [
        { label: 'מנהל מערכת', value: '1' },
        { label: 'משתמש רגיל', value: '2' },
        { label: 'משתמש בלי זכות הצבעה', value: '3' },
        { label: 'מבקר', value: '4' }
      ],
      defaultValue: '2'
    },
    {
      name: 'legacyId',
      label: 'מספר משתמש',
      type: 'number',
      index: true
    },
    {
      name: 'firms',
      label: 'חברות',
      type: 'array',
      fields: [
        {
          type: "row",
          fields: [
            {
              name: 'firmId',
              type: 'relationship',
              relationTo: 'firms',
              required: true,
            },
            {
              name: 'emailOnNoHoldings',
              label: 'התראה על אי החזקות',
              type: 'checkbox',
            },
            {
              name: 'votePermission',
              label: 'הרשאת הצבעה',
              type: 'checkbox',
            }
          ]
        }
      ]
    },
    {
      name: 'userIp',
      label: 'כתובות IP',
      type: 'text',
      admin: {
        description: 'הזן כתובות IP מופרדות בנקודה-פסיק (;)'
      }
    },
    {
      name: 'showQr',
      label: 'הצג QR',
      type: 'checkbox',
    },
    {
      name: 'changePassword',
      label: 'שינוי סיסמה',
      type: 'checkbox',
    },
    {
      name: 'lastLogin',
      label: 'התחברות אחרונה',
      type: 'text',
    },
    {
      name: 'qrCodeData',
      label: 'נתוני QR',
      type: 'group',
      fields: [
        {
          name: 'createDate',
          label: 'תאריך יצירה',
          type: 'date',
        },
        {
          name: 'lastCodeFailureDate',
          label: 'תאריך כישלון אחרון',
          type: 'date',
        },
        {
          name: 'codeFailuresSinceLastSuccess',
          label: 'מספר כישלונות מאז הצלחה אחרונה',
          type: 'number',
        }
      ]
    },
    ...userFields,
  ]
}
