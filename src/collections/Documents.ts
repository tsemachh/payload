import type { CollectionConfig } from 'payload'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: {
    plural: 'מסמכי משתמשים',
    singular: 'מסמך משתמש',
  },
  enableQueryPresets: true,
  access: {
    read: () => true,
  },
  admin: {
    group: 'מסמכים',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [
      ['createdAt']
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'הסבר', //todo: this field is required??
      type: 'text',
    },
  ],
  upload: { skipSafeFetch: true },
}
