import type { CollectionConfig } from 'payload'

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
  versions: {
    drafts: false,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'stockId',
          label: 'מזהה',
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
        },
        {
          name: 'stockLink',
          label: 'Stock Link',
          type: 'text',
          admin: {
            components: {
              Cell: {
                path: '/components/link/LinkFromRelationField',
                clientProps: {
                  relationField: 'stockId',
                  baseUrl: 'https://market.tase.co.il/he/market_data/security/',
                  suffix: '/major_data',
                },
              },
            },
            readOnly: true,
          },
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
                  return (data.closingRate * data.registeredValue) / 100
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
        },
      ],
    },
  ],
}
