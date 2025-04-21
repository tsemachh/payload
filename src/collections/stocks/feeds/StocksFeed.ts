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
  hooks: {
    afterChange: [
      async ({ req, doc  }) => {
        if (req.context?.from !== 'process') {
          await processStocksFeedCsv(req, doc)
        }
      },
    ],
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