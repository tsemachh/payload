import type { CollectionConfig } from 'payload'

export const Holdings: CollectionConfig = {
  slug: 'holdings',
  labels: {
    plural: 'אחזקות',
    singular: 'אחזקה',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['account', 'stock', 'quantity', 'valueDate'],
  },
  versions: {
    drafts: false,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'account',
          label: 'חשבון',
          type: 'relationship',
          relationTo: 'accounts',
          required: true,
          index: true,
        },
        {
          name: 'stock',
          label: 'נייר ערך',
          type: 'relationship',
          relationTo: 'stocks',
          required: true,
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'quantity',
          label: 'כמות',
          type: 'number',
          required: true,
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
  ],
}
