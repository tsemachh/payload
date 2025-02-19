import type { CollectionConfig } from 'payload'

export const Document: CollectionConfig = {
  slug: 'document',
  labels: {
    plural: 'מסמכים',
    singular: 'מסמך',
  },
  access: {
    read: () => true,
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
