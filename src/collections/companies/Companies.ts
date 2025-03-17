import type { CollectionConfig } from 'payload'

export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: {
    plural: 'חברות',
    singular: 'חברה',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name', 'companyId','accounts','parentCompany','subCompanies'
    ],
    listSearchableFields: ['name', 'companyId'],
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  versions: {},
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'companyId',
          label: 'מספר חברה',
          type: 'number',
          index: true,
          admin: { hidden: true },
        },
        {
          name: 'order',
          type: 'number',
          index: true,
          admin: { hidden: true },
        },
        {
          name: 'name',
          label: 'שם',
          type: 'text',
          required: true,
        },
        {
          name: 'active',
          label: 'האם פעיל',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'parentCompany',
          type: 'join',
          label: 'חברת אם',
          collection: 'companies',
          on: 'subCompanies',
          defaultLimit: 1,
          admin:{
            allowCreate: false,
            defaultColumns:["name","subCompanies","parentCompany"],
            description: 'חברת האם , חברות בנות של חברת האם וחברת האם של חברת האם'
          }
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'subCompanies',
          type: 'relationship',
          label: 'חברות בת',
          index: true,
          relationTo: 'companies',
          hasMany: true,
          admin: {
            className: 'subCompanies',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'showResearch',
          label: 'הצג מחקר',
          type: 'checkbox',
        },
        {
          name: 'setResearchAsDefault',
          label: 'הגדר מחקר כברירת מחדל',
          type: 'checkbox',
        },
        {
          name: 'showResearchBond',
          label: 'הצג מחקר אג"ח',
          type: 'checkbox',
        },
        {
          name: 'setResearchAsDefaultBond',
          label: 'הגדר מחקר אג"ח כברירת מחדל',
          type: 'checkbox',
        },
        {
          name: 'showResearchTrusteeship',
          label: 'הצג מחקר נאמנות',
          type: 'checkbox',
        },
        {
          name: 'setResearchAsDefaultTrusteeship',
          label: 'הגדר מחקר נאמנות כברירת מחדל',
          type: 'checkbox',
        },
      ],
    },
    {
      name: 'accounts',
      label: 'חשבונות',
      type: 'join',
      collection: 'accounts',
      on: 'company',
      where: { isCentralAccount: { equals: true } },
      admin: {
        defaultColumns: ['accountNumber', 'name', 'isCentralAccount'],
        condition: (siblingData) => !siblingData.subCompanies || siblingData.subCompanies?.length == 0,
      },
    },
    {
      type:'join',
      collection: 'meetings',
      on: 'companies',
      name: 'meetings'
    }
  ],
}