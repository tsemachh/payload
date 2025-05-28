import { CollectionConfig } from 'payload'

export const Reasons: CollectionConfig = {
  slug: 'reasons',
  labels: {
    singular: 'נימוק',
    plural: 'נימוקים',
  },
  admin: {
    useAsTitle: 'content',
  },
  fields: [
    {
      name: 'content',
      type: 'textarea',
      label: 'תוכן הנימוק',
      required: true,
    },
  ],
}
