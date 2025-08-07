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
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
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
