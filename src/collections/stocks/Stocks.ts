import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  admin: {
    useAsTitle: 'symbol', // Use the stock symbol as the title in the admin panel
  },
  versions: {
    drafts: false,
    maxPerDoc: 365, // Store one year of historical data through versions //TDOO how much history we want tosave per stock
  },
  fields: [
    {
      name: 'stockID',
      type: 'number',
      unique: true, // Ensure stockID is unique
      required: true,
      index : true
    },
    {
      name: 'name',
      type: 'text',
      //required: true,
    },
    {
      name: 'symbol',
      type: 'text',
      //required: true,
      index: true, //index for faster queries
    },
    {
      name: 'type',
      type: 'select',
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
    },
    {
      name: 'marketValue',
      type: 'number',
    },
    {
      name: 'registeredValue',
      type: 'number',
    },
    {
      name: 'valueDate',
      type: 'date',
      required: true,
    },
    {
      name: 'longName',
      type: 'text',
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Ensure valueDate is set to the current date if not provided
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
