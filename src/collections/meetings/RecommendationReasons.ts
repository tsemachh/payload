import { CollectionConfig } from 'payload'

export const RecommendationReasons: CollectionConfig = {
  slug: 'recommendation-reasons',
  labels: {
    singular: 'נימוק המלצה',
    plural: 'נימוקי המלצה',
  },
  admin: {
    useAsTitle: 'content',
    group: 'ניהול',
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
