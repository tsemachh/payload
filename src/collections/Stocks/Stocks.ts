import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  admin: {
    useAsTitle: 'symbol',
    // Remove invalid list view configuration
    defaultColumns: ['stockID', 'symbol', 'name', 'type', 'valueDate'],
    // Group is not supported in this way - we'll use field-level layout instead
  },
  versions: {
    drafts: false,
    maxPerDoc: 365,
  },
  fields: [
    {
      name: 'stockID',
      type: 'number',
      unique: true,
      required: true,
      index: true,
      admin: {
        description: 'Stock ID can only be set during creation',
        position: 'sidebar',
        condition: (data) => {
          // Only allow editing if document is new (no id exists)
          return !data?.id
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      admin: {
        width: '50%',
      },
    },
    {
      name: 'symbol',
      type: 'text',
      index: true,
      admin: {
        width: '50%',
      },
    },
    {
      name: 'type',
      type: 'select',
      admin: {
        width: '50%',
      },
      options: [
        { label: 'מניות', value: 'מניות' },
        { label: 'כתבי אופציה', value: 'כתבי אופציה' },
        { label: 'איגרות חוב', value: 'איגרות חוב' },
        { label: 'איגרות חוב להמרה', value: 'איגרות חוב להמרה' },
        { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
        { label: 'תעודות מדד', value: 'תעודות מדד' },
        { label: 'תעודות סל', value: 'תעודות סל' },
      ],
    },
    {
      name: 'closingRate',
      type: 'number',
      admin: {
        width: '33%',
      },
    },
    {
      name: 'marketValue',
      type: 'number',
      admin: {
        width: '33%',
      },
    },
    {
      name: 'registeredValue',
      type: 'number',
      admin: {
        width: '33%',
      },
    },
    {
      name: 'valueDate',
      type: 'date',
      required: true,
      admin: {
        width: '50%',
      },
    },
    {
      name: 'longName',
      type: 'text',
      admin: {
        width: '50%',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data }) => {
        if (!data.valueDate) {
          return {
            ...data,
            valueDate: new Date(),
          }
        }
        return data
      },
    ],
  },
}
