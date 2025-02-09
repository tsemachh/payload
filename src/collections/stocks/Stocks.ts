import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    plural: 'מניות',
    singular: 'מניה',
  },
  admin: {
    useAsTitle: 'stockID',
    defaultColumns: [
      'stockID',
      'type',
      'valueDate',
      'symbol',
      'name',
      'longName',
      'closingRate',
      'marketValue',
      'registeredValue',
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
          label: "מס' נייר",
          type: 'number',
          unique: true,
          required: true,
          index: true,
          admin: {
            width: '33%',
            condition: (data) => !data?.id,
            description: 'מזהה מניה ניתן לעריכה רק בעת יצירה',
          },
        },
        {
          name: 'type',
          label: 'סוג נייר ערך',
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
          label: 'תאריך ערך',
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
          label: 'סימול',
          type: 'text',
          index: true,
          admin: {
            width: '33%',
          },
        },
        {
          name: 'name',
          label: 'שם נייר',
          type: 'text',
          admin: {
            width: '33%',
          },
        },
        {
          name: 'longName',
          label: 'שם מלא',
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
