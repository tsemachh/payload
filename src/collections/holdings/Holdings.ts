import type { CollectionConfig } from 'payload'
import { updateCompaniesMeetingsOnHoldingChange } from './hooks/updateCompaniesMeetings'

export const Holdings: CollectionConfig = {
  slug: 'holdings',
  labels: {
    plural: 'אחזקות',
    singular: 'אחזקה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['account', 'stock', 'quantity', 'valueDate'],
    group: 'אוספים משניים',
  },
 hooks: {
    afterChange: [
      async ({ req, doc }) => {
        if (req.context?.from != 'migration')
          await updateCompaniesMeetingsOnHoldingChange(req, doc)
      },
    ],
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
