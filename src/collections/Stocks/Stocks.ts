import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  admin: {
    useAsTitle: 'stockID', //
    defaultColumns: ['stockID', 'symbol', 'name', 'type', 'valueDate'],
  },
  versions: {
    drafts: false,
    maxPerDoc: 365,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'stockID',
          type: 'number',
          unique: true,
          required: true,
          index: true,
          admin: {
            width: '33%',
            condition: (data) => !data?.id,
            description: 'Stock ID can only be set during creation',
            
          },
        },
        {
          name: 'symbol',
          type: 'text',
          index: true,
          admin: {
            width: '33%',
          },
        },
        {
          name: 'name',
          type: 'text',
          admin: {
            width: '33%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
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
          name: 'longName',
          type: 'text',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
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
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'valueDate',
          type: 'date',
          required: true,
          admin: {
            width: '50%',
          },
        },
      ],
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
