import type { CollectionConfig } from 'payload'

export const Accounts: CollectionConfig = {
  slug: 'accounts',
  labels: {
    plural: 'חשבונות',
    singular: 'חשבון',
  },
  admin: {
    useAsTitle: 'accountNumber',
    defaultColumns: ['name', 'accountNumber', 'firm'],
    listSearchableFields: ['name', 'accountNumber'],
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // Validate that a sub-account cannot be a central account
        if (data?.parentAccount && data?.isCentralAccount) {
          throw new Error('A sub-account cannot be a central account')
        }
        return data
      }
    ]
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'accountNumber',
          label: 'מספר חשבון',
          type: 'number',
          required: true,
          index: true,
        },
        {
          name: 'name',
          label: 'שם החשבון',
          type: 'text',
          required: true,
        },
        {
          name: 'firm',
          label: 'חברה',
          type: 'relationship',
          relationTo: 'firms',
          required: true,
          index: true,
        },
        {
          name: 'isCentralAccount',
          label: 'חשבון מרכז',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'parentAccount',
          label: 'חשבון מרכז משויך',
          type: 'relationship',
          relationTo: 'accounts',
          index: true,
          admin: {
            condition: (data) => !data.isCentralAccount,
          },
        },
      ],
    },
  ],
}
