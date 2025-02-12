import type { CollectionConfig } from 'payload'

export const Test: CollectionConfig = {
  slug: 'test',
  labels: {
    plural: 'בדיקות',
    singular: 'בדיקה',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'test1',
      type: 'text',
    },
    {
      name: 'test2',
      type: 'text',
    },
    {
      name: 'test3',
      type: 'text',
    },
  ],
}
