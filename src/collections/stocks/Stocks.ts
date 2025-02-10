import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    plural: 'ניירות ערך',
    singular: 'נייר ערך',
  },
  admin: {
    useAsTitle: 'stockID',
    defaultColumns: [
      'stockID',
      'type',
      'symbol',
      'name',
      'longName',
      'registeredValue',
      'valueDate',
      'closingRate',
      'marketValue',
    ],
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
          label: 'מזהה', // Stock ID
          type: 'number',
          unique: true,
          required: true,
          index: true,
          admin: {
            width: '33%',
            condition: (data) => !data?.id,

            // readOnly: typeof window !== 'undefined' && window.location.pathname.includes('/create'),
            description: 'מזהה נייר ערך ניתן לעריכה רק בעת יצירה', // Stock ID can only be set during creation
          },
          // hooks: {
          //   beforeChange: [
          //     ({ data, req }) => {
          //       // Prevent stockID modification if document exists
          //       if (req.method === 'PUT' && data.id) {
          //         // Remove stockID from update payload
          //         delete data.stockID
          //       }
          //       return data
          //     }
          //   ]
          // },
          // access: {
          //   update: ({ req }) => !req.doc, // Only allow if no existing document
          // },
        },
        {
          name: 'type',
          label: 'סוג', // Type
          type: 'select',
          admin: {
            width: '33%',
          },
          options: [
            { label: 'מניות', value: 'מניות' },
            { label: 'אופציות', value: 'אופציות' },
            { label: 'כתבי אופציה', value: 'כתבי אופציה' },
            { label: 'איגרות חוב', value: 'איגרות חוב' },
            { label: 'איגרות חוב להמרה', value: 'איגרות חוב להמרה' },
            { label: 'יחידת השתתפות', value: 'יחידת השתתפות' },
            { label: 'תעודות מדד', value: 'תעודות מדד' },
            { label: 'תעודות סל', value: 'תעודות סל' },
            { label: 'קרנות נאמנות', value: 'קרנות נאמנות' },
            { label: 'נייר ערך מסחרי', value: 'נייר ערך מסחרי' },
            { label: 'אחר', value: 'אחר' },
            { label: 'זכויות', value: 'זכויות' },
            { label: 'מק"מ', value: 'מק"מ' },
            { label: 'שטרי הון', value: 'שטרי הון' },
          ],
        },
        {
          name: 'valueDate',
          label: 'תאריך ערך', // Value Date
          type: 'date',
          required: true,
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
          name: 'symbol',
          label: 'סמל', // Symbol
          type: 'text',
          index: true,
          admin: {
            width: '33%',
          },
        },
        {
          name: 'name',
          label: 'שם', // Name
          type: 'text',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'longName',
          label: 'שם מלא', // Long Name
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
          name: 'closingRate',
          label: 'שער סגירה', // Closing Rate
          type: 'number',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'marketValue',
          label: 'שווי שוק', // Market Value
          type: 'number',
          admin: {
            width: '33%',
            readOnly: true, // Prevent user modification
          },
          hooks: {
            beforeChange: [
              ({ siblingData }) => {
                // Prevent storing the computed field in the database
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
          label: 'הון רשום', // Registered Value
          type: 'number',
          admin: {
            width: '33%',
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
