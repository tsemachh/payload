import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  admin: {
    useAsTitle: 'symbol', // Use the stock symbol as the title in the admin panel
  },
  versions: {
    drafts: false,
    maxPerDoc: 365, // Store one year of historical data through versions
  },
  fields: [
    {
      name: 'stockID',
      type: 'number',
      unique: true, // Ensure stockID is unique
      //required: true,
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
      type: 'text',
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
      name: 'logUpdateID',
      type: 'number',
    },
    {
      name: 'longName',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Delisted', value: 'delisted' },
      ],
      defaultValue: 'active',
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
