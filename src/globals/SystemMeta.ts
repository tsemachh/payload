import { GlobalConfig } from 'payload'

export const SystemMeta: GlobalConfig = {
  slug: 'system-meta',
  label: 'מטא מערכת',
  admin: {
    group: 'ניהול',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'companyLastUpdateDate',
      type: 'date',
      label: 'תאריך עדכון אחרון של חברות',
      admin: {
        readOnly: true,
      },
    },
  ],
}
