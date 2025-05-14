import type { CollectionConfig } from 'payload'

// Utility to format numbers with thousands separators
const formatNumber = (value: any) =>
  typeof value === 'number' ? value.toLocaleString('en-US') : value

export const StockValues: CollectionConfig = {
  slug: 'stock-values',
  labels: {
    plural: 'שווי ניירות ערך',
    singular: ' שווי נייר ערך',
  },
  admin: {
    hidden: true,
    useAsTitle: 'stockId',
    defaultColumns: ['stockId', 'valueDate', 'registeredValue', 'closingRate', 'marketValue'],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'stockId',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
        },
        {
          name: 'valueDate',
          label: 'תאריך ערך',
          type: 'date',
          required: true,
          index: true,
          admin: {
            date: {
              displayFormat: 'dd MMM yyy',
              pickerAppearance: 'default',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'closingRate',
          label: 'שער סגירה',
          type: 'number',
          hooks: {
            afterRead: [({ value }) => formatNumber(value)],
          },
        },
        {
          name: 'marketValue',
          label: 'שווי שוק',
          type: 'number',
          admin: {
            readOnly: true,
          },
          hooks: {
            beforeChange: [
              ({ siblingData }) => {
                delete siblingData['marketValue']
              },
            ],
            afterRead: [
              ({ data }) => {
                if (data?.closingRate && data?.registeredValue) {
                  const value = (data.closingRate * data.registeredValue) / 100
                  return formatNumber(value)
                }
                return null
              },
            ],
          },
        },
        {
          name: 'registeredValue',
          label: 'הון רשום',
          type: 'number',
          hooks: {
            afterRead: [({ value }) => formatNumber(value)],
          },
        },
      ],
    },
  ],
}
