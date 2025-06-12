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
    {
      name: 'hash',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // Don't modify the hash if it's already set
            if (siblingData.hash) return siblingData.hash;
            return undefined;
          },
        ],
      },
    },
  ],
  upload: true,
}
