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
      'name','companyId'
    ],
    listSearchableFields: ['name','companyId'],
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50,100,200,500],
    },
  },
  versions: {
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'companyId',
          label: 'מספר חברה',
          type: 'number',
          unique: true,
          required: true,
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
      ],
    },
    {
      name: 'subCompanies',
      type : 'relationship',
      label: 'חברות בת',
      relationTo: 'companies',
      hasMany : true,
      admin:{
        className :"subCompanies"
      }
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
      where : {isCentralAccount:{equals:true}},
      admin: {
        defaultColumns: ['accountNumber', 'name', 'isCentralAccount'],
        condition: (siblingData) => !siblingData.subCompanies || siblingData.subCompanies?.length == 0
      },
    },
/*    {
      name: 'users',
      label: 'משתמשים',
      type: 'join',
      collection: 'users',
      on: 'firmId',
      admin: { defaultColumns: [ 'name'] },
    }*/
  ],
}