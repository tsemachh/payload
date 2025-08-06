import { CollectionConfig } from 'payload'

const StockMigrationMapping: CollectionConfig = {
  slug: 'stock-migration-mapping',
  admin: {
    useAsTitle: 'stockId',
    group: 'פיתוח',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [
      [{ name:'type'}]
    ],
  },
  labels: {
    plural: 'מיפויי ניירות ערך',
    singular: 'מיפוי ניירות ערך',
  },
  fields: [
    {
      name: 'stockId',
      type: 'number',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Foreign',
          value: 'Foreign',
        },
        {
          label: 'NotActive',
          value: 'NotActive',
        },
        {
          label: 'Private',
          value: 'Private',
        },
        {
          label: 'NonTradable',
          value: 'NonTradable',
        },
      ],
    },
    {
      name: 'isin',
      type: 'text',
      admin: {
        condition: (data) => {
          return data.type === 'Foreign'
        },
      },
    },
  ],
}

export default StockMigrationMapping
