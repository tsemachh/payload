import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    plural: 'ניירות ערך',
    singular: 'נייר ערך',
  },
  admin: {
    useAsTitle: 'stockId',
    defaultColumns: [
      'stockId',
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
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'stockId',
          type: 'number',
          unique: true, // Ensure stockID is unique
          required: true,
          index : true,
          label: "מס' נייר",
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
        }
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
      name: 'values',
      label:'ערכים' ,
      type: 'join',
      collection: 'stock-values',
      on: 'stockId',
      admin:{defaultColumns:['valueDate',
          'registeredValue',
          'closingRate',
          'marketValue']}
    }
  ]
}
