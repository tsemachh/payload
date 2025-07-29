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
