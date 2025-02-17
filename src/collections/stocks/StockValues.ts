import type { CollectionConfig } from 'payload'

export const StockValues: CollectionConfig = {
  slug: 'stock-values',
  labels: {
    plural: 'שווי ניירות ערך',
    singular: ' שווי נייר ערך',
  },
  admin: {
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
          label: "מס' נייר",
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
          admin: {
            width: '33%',
          },
        },
        // {
        //   name: 'link',
        //   label: 'ghyurejfhiltgjro;hujk[py7//////////stockIDחר',
        //   type: 'text',
        //   admin: {
        //     width: '40%',
        //     components: {
        //       Field: {
        //         path: '/components/text/TextFromRelationField',
        //         clientProps: {
        //           relationField: 'profileEntity',
        //           relationDisplayField: 'fullName',
        //           fetchEndpoint: '/api/individualprofiles',
        //         },
        //       },
        //     },
        //   },
        // },
        //https://github.com/shefing/cm-website/blob/develop/packages/payload/src/components/text/TextFromRelationField.tsx
        {
          name: 'valueDate',
          label: 'תאריך ערך',
          type: 'date',
          required: true,
          admin: {
            date: {
              displayFormat: 'dd MMM yyy',
              pickerAppearance: 'default',
            },
            width: '33%',
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
          admin: {
            width: '33%',
          },
        },
        {
          name: 'marketValue',
          label: 'שווי שוק',
          type: 'number',
          admin: {
            width: '33%',
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
          admin: {
            width: '33%',
          },
        },
      ],
    },
  ],
}
