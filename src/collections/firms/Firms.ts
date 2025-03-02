import type { CollectionConfig } from 'payload'
export const FirmsGroups: CollectionConfig = {
  slug: 'firms-groups',
  labels: {
    plural: ' קבוצות חברות',
    singular: ' קבוצת חברות',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name', 'groupId'
    ],
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
          name: 'groupId',
          label: 'מספר קבוצה',
          type: 'number',
          unique: true,
          required: true,
          index: true,
          admin: { hidden: true },
        },
        {
          name: 'name',
          label: 'שם',
          type: 'text',
          required: true,
        },
      ]
    },
    {
      name: 'firms',
      label: 'חברות',
      type: 'join',
      collection: 'firms',
      on: 'groups',
      admin: { defaultColumns: ['firmId', 'name'] },
    }
    ]
}

export const Firms: CollectionConfig = {
  slug: 'firms',
  labels: {
    plural: 'חברות',
    singular: 'חברה',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name','firmId'
    ],
    listSearchableFields: ['name','firmId'],
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
          name: 'firmId',
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
          name: 'groups',
          label: 'קבוצת חברות',
          type: 'relationship',
          relationTo: 'firms-groups',
          index: true,
          hasMany: true
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
      on: 'firm',
      where : {isCentralAccount:{equals:true}},
      admin: { defaultColumns: ['accountNumber', 'name', 'isCentralAccount'] },
    }
  ],
}
