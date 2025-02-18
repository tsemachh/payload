import type { CollectionConfig } from 'payload'

export const Stocks: CollectionConfig = {
  slug: 'stocks',
  labels: {
    plural: 'ניירות ערך',
    singular: 'נייר ערך',
  },
  admin: {
    useAsTitle: 'stockId',
    defaultColumns: ['stockId', 'type', 'symbol', 'name', 'longName'],
    listSearchableFields: ['stockId', 'type', 'symbol', 'name', 'longName'],
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
          type: 'text',
          label: 'מזהה נייר ערך',
          unique: true,
          required: true,
          index: true,
          access: {
            update: () => false,
          },
          admin: {
            description: 'ניתן להעריכה רק בעת יצירת נייר הערך',
          },
        },
        {
          name: 'type',
          label: 'סוג נייר ערך',
          type: 'select',
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
          index: true
        },
        {
          name: 'relatedStock',
          label: 'נייר מקביל(נסחר)',
          type: 'relationship',
          relationTo: 'stocks',
          index: true,
          admin: {
            condition: (siblingData) => !siblingData.tradable,
          },
          filterOptions: () => ({
            tradable: {
              equals: true,
            },
          }),
        },
        {
          name: 'tradable',
          label: 'מניה נסחרת',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '25%',
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
          index: true,
          admin: {
            width: '33%',
          },
        },
        {
          name: 'longName',
          label: 'שם מלא',
          type: 'text',
          index: true,
          admin: {
            width: '33%',
          },
        },
      ],
    },
    {
      name: 'values',
      label: 'ערכים',
      type: 'join',
      collection: 'stock-values',
      on: 'stockId',
      admin: { defaultColumns: ['valueDate', 'registeredValue', 'closingRate', 'marketValue'] },
    },
    {
      name: 'relations',
      label: 'מקושרים',
      type: 'join',
      collection: 'stocks',
      on: 'relatedStock',
      admin: { defaultColumns: ['stockId', 'type', 'symbol', 'name', 'longName'] },
    },
   {
      name: 'meetings',
      label: 'פגישות',
      type: 'join',
      collection: 'meetings',
      on: 'stock',
      admin: { defaultColumns: ['meetingId', 'meetingDate', 'meetingType'] },
    },
  ],
}
