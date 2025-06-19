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
    group: 'פעילות',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
