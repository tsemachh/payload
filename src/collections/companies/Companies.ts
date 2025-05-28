
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import addSubAccountEndPoint from './addSubAccountEndPoint'
import detailsEndpoint from './detailsEndpoint'

const beforeChangeCompanyId: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation == 'create') {
    if (!data.companyId) {
      const response = await req.payload.find({
        collection: 'companies',
        sort: '-companyId',
        select: {
          companyId: true,
        },
        limit: 1,
      })
      data.companyId = (response?.docs[0].companyId as number) + 10
    }
  }
  return data
}

export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: {
    plural: 'חברות',
    singular: 'חברה',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'companyId', 'accounts', 'parentCompany', 'subCompanies'],
    listSearchableFields: ['name', 'companyId'],
    pagination: {
      defaultLimit: 500,
      limits: [10, 20, 50, 100, 200, 500],
    },

  },
  versions: {},
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'תוכן',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'type',
                  type: 'select',
                  admin: {hidden: true},
                  defaultValue: 'regular',
                  options: ['regular','parent','fund']
                },
                {
                  name: 'companyId',
                  label: 'מספר חברה',
                  type: 'number',
                  index: true,
                  admin: { hidden: false },
                },
                {
                  name: 'legacyCompanyId',
                  label: 'מספר חברה מקורי בפרדיקטה',
                  type: 'number',
                  index: true,
                  admin: { hidden: false },
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
                  maxDepth: 2,
                  admin: {
                    allowCreate: false,
                    defaultColumns: ['name', 'subCompanies', 'parentCompany', 'companyId'],
                    description: 'חברת האם , חברות בנות של חברת האם וחברת האם של חברת האם',
                  },
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
              name: 'researchDocuments',
              label: 'חוות דעת',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'showResearchTrusteeship',
                      label: 'אג"ח נאמנות',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: {
                        condition: (data) => !!data?.mainAccount?.[0],
                      },
                    },
                    {
                      name: 'showResearchBond',
                      label: 'אג"ח',
                      type: 'checkbox',
                      admin: {
                        condition: (data) => !!data?.mainAccount?.[0],
                      },
                    },
                    {
                      name: 'showResearch',
                      label: 'כללי',
                      type: 'checkbox',
                      admin: {
                        condition: (data) => !!data?.mainAccount?.[0],
                      },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'showResearchPrivate',
                      label: 'מקבל מסמכי מחקר פרטנים',
                      type: 'checkbox',
                      admin: {
                        condition: (data) => !!data?.mainAccount?.[0],
                      },
                    },
                    {
                      name: 'defaultVotingRecommendation',
                      label: 'המלצת הצבעה כברירת מחדל',
                      type: 'checkbox',
                      admin: {
                        condition: (data) => !!data?.mainAccount?.[0],
                      },
                    },
                  ],
                },
              ],
            }


          ],
        },
        {
          label: 'חשבונות',
          fields: [
            {
              name: 'mainAccount',
              label: 'חשבון ראשי',
              type: 'array',
              fields: [
                {
                  name: 'accountNumber',
                  label: 'מספר חשבון',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'accountName',
                  label: 'שם חשבון',
                  type: 'text',
                },
                {
                  name: 'subAccounts',
                  label: 'תתי חשבונות',
                  type: 'text',
                  hasMany: true,
                },
              ],
            }
          ],
        },
        {
          label: 'פגישות',
          fields: [
            {
              type: 'join',
              collection: 'meetings',
              on: 'companies',
              name: 'meetings',
            },
          ],
        },
        {
          label: 'אחזקות',
          fields: [
            {
              type: 'join',
              collection: 'holdings',
              on: 'company',
              name: 'holdings',
            },
          ],
        },
        {
          label: 'ניירות ערך מושתקים',
          fields: [
            {
              name: 'silencedStocks',
              label: 'ניירות ערך מושתקים',
              type: 'text',
              hasMany: true,
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [beforeChangeCompanyId],
  },
  endpoints: [
    {
      path: '/addSubAccount',
      method: 'post',
      handler: addSubAccountEndPoint,
    },
    {
      path: '/details',
      method: 'get',
      handler: detailsEndpoint,
    },
  ],
}
