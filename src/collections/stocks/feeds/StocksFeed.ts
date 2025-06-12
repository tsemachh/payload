import type { CollectionConfig } from 'payload'
import { processStocksFeedCsv } from './processStocksFeedCsv'

export const StocksFeed: CollectionConfig = {
  slug: 'stocks-feed',
  labels: {
    plural: 'קבצי מניות',
    singular: 'קובץ מניות',
  },
  admin: {
    useAsTitle: 'filename',
    group: 'ניהול',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'comments',
      type: 'text',
      label: 'הערות',
    },
  ],
  upload: true,
}