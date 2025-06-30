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
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
    group: 'ניהול',
  },
  versions: {},
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'כללי',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  label: 'שם',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '500px',
                  },
                },
                {
                  name: 'active',
                  label: 'האם פעיל',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    hidden: false,
                    width: '100px',
                  },
                },
                {
                  name: 'type',
                  label: 'סוג',
                  type: 'select',
                  defaultValue: 'regular',
                  options: [
                    { value: 'regular', label: 'רגיל' },
                    { value: 'parent', label: 'הורה' },
                    { value: 'fund', label: 'תיק' },
                  ],
                  admin: {
                    hidden: false,
                    width: '120px',
                  },
                },
                {
                  name: 'passiveFund',
                  label: 'קרן מחקה',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    width: '150px',
                    condition: (data) => data?.type == 'fund',
                  },
                },
                {
                  name: 'companyId',
                  label: 'מספר חברה',
                  type: 'number',
                  index: true,
                  admin: {
                    hidden: false,
                    width: '100px',
                  },
                },
                {
                  name: 'legacyCompanyId',
                  label: 'מספר מקורי',
                  type: 'number',
                  index: true,
                  admin: {
                    hidden: false,
                    width: '100px',
                  },
                },
                {
                  name: 'order',
                  type: 'number',
                  index: true,
                  admin: {
                    hidden: false,
                    width: '100px',
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
                    condition: (data) => data?.type != 'fund',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
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
                    defaultColumns: ['name', 'type', 'subCompanies', 'parentCompany', 'companyId'],
                    description: 'חברת האם , חברות בנות של חברת האם וחברת האם של חברת האם',
                  },
                },
              ],
            },
            {
              name: 'researchDocuments',
              label: 'חוות דעת',
              type: 'group',
              admin: {
                condition: (data) => data?.type == 'regular',
              },
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
                        width: '200px',
                      },
                    },
                    {
                      name: 'showResearchBond',
                      label: 'אג"ח',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'showResearch',
                      label: 'כללי',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
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
                        width: '200px',
                      },
                    },
                    {
                      name: 'defaultVotingRecommendation',
                      label: 'המלצת הצבעה כברירת מחדל',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
                      },
                    },
                  ],
                },
                {
                  name: 'researchDocuments',
                  type: 'join',
                  label: 'מסמכי מחקר פרטניים',
                  collection: 'research-documents',
                  on: 'companies',
                  maxDepth: 0,
                  admin: {
                    allowCreate: false,
                    defaultColumns: ['filename'],
                    condition: (siblingData) => {
                      return siblingData?.researchDocuments?.showResearchPrivate === true
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'חשבונות',
          admin: {
            condition: (data) => data?.type == 'fund',
          },
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
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'subAccounts',
                  label: 'תתי חשבונות',
                  type: 'text',
                  hasMany: true,
                },
              ],
            },
          ],
        },
        {
          label: 'פגישות',
          admin: {
            condition: (data) => data?.type == 'regular',
          },
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
          admin: {
            condition: (data) => data?.type == 'fund',
          },
          fields: [
            {
              type: 'join',
              collection: 'holdings',
              on: 'fund',
              name: 'holdings',
            },
          ],
        },
        {
          label: 'ניירות ערך מושתקים',
          admin: {
            condition: (data) => data?.type == 'regular',
          },
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
    afterChange: [
      async ({ doc, req, previousDoc }) => {
        // Only proceed if the company is of type 'fund'
        const isRegular = doc.type === 'regular'

        if (isRegular) {
          try {
            if (
              JSON.stringify(doc.subCompanies) != JSON.stringify(previousDoc.subCompanies) ||
              doc.active != previousDoc.active
            ) {
              await req.payload.update({
                req: {
                  ...req,
                  context: { ...req.context, from: 'process' },
                },
                collection: 'users',
                where: {
                  'companies.companyId': {
                    equals: doc.id,
                  },
                },
                data: {
                  funds: [],
                },
              })
            }
          } catch (error) {
            console.error('Error updating users after fund company change:', error)
          }
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/add-sub-account',
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
