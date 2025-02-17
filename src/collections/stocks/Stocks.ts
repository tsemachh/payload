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
          type: 'number',
          label: 'מזהה נייר ערך',
          unique: true, // Ensure stockID is unique
          required: true,
          index: true,
          access: {
            update: () => false, // Prevent updates to the field
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
            { label: 'אופציה', value: 'אופציה' },
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
          name: 'tradable',
          label: 'נייר נסחר',
          type: 'checkbox',
        },
        {
          name: 'relatedStock',
          label: 'נייר מקביל(נסחר)',
          type: 'relationship',
          relationTo: 'stocks',
          admin: {
            // Display the field only if 'tradable' is false
            condition: (siblingData) => !siblingData.tradable,
          },
          filterOptions: () => ({
            tradable: {
              equals: true,
            },
          }),
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
