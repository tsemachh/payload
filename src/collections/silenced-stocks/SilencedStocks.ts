import type { CollectionConfig } from 'payload'
import upsertSilencedStocksEndPoint from './upsertSilencedStocksEndPoint'

export const SilencedStocks: CollectionConfig = {
  slug: 'silenced-stocks',
  labels: {
    plural: 'ניירות ערך מושתקים',
    singular: 'נייר ערך מושתק',
  },
  admin: {
    useAsTitle: 'stockId',
    defaultColumns: ['stockId', 'companies'],
    listSearchableFields: ['stockId'],
    group: 'אוספים משניים',
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  fields: [
    {
      name: 'stockId',
      type: 'text',
      label: 'מספר נייר',
      unique: true,
      required: true,
      index: true,
    },
    {
      name: 'companies',
      label: 'חברות',
      type: 'relationship',
      hasMany: true,
      relationTo: 'companies',
      index: true,
    },
  ],
  endpoints: [
    {
      path: '/upsert',
      method: 'post',
      handler: upsertSilencedStocksEndPoint,
    },
  ],
}