import { CollectionConfig } from 'payload'

export const RecommendationReasons: CollectionConfig = {
  slug: 'recommendation-reasons',
  labels: {
    singular: 'נימוק',
    plural: 'נימוקים',
  },
  admin: {
    useAsTitle: 'content',
    group: 'אוספים משניים',
  },
  fields: [
    {
      name: 'content',
      type: 'text',
      label: 'תוכן הנימוק',
      required: true,
    },
  ],
}
