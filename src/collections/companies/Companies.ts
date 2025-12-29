import type { CollectionBeforeChangeHook, CollectionConfig, Where } from 'payload'
import addSubAccountEndPoint from './addSubAccountEndPoint'
import { detailsEndpoint, getVotingRecommendation } from './detailsEndpoint'
import { isAdmin, isUserCompany } from '@/utils/authUtils'
import {
  addTagToCompany,
  deleteTagFromCompany,
  getLabelsForCompanies,
  updateTagInCompany,
} from './createLabels'
import { syncMeetingsOnCompanyChange } from './hooks/syncMeetings'
import { logEvent } from '@/lib/audit/logEvent'
import { invalidateActiveFundsCache } from '@/collections/meetings/hooks/activeCompaniesCache'

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
  orderable: true,
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
  defaultSort: '_order',
  access: {
    create: isAdmin,
    read: isUserCompany,
    update: isAdmin,
    delete: isAdmin,
  },
  custom: {
    filterList: [
      [
        'type',
        'active',
        'passiveFund',
        'researchDocuments.displayVotingRecommendation',
        'researchDocuments.defaultVotingRecommendation',
      ],
      [
        'researchDocuments.showResearch',
        'researchDocuments.showResearchPrivate',
        'researchDocuments.howResearchTrusteeship',
        'researchDocuments.showResearchBond',
      ],
    ],
    defaultFilter: { active: { equals: 'true' } },
  },
  versions: {},
  indexes: [
    {
      fields: ['type', 'active'],
    },
    {
      fields: ['label.labels.labelId'],
    },
    {
      fields: ['_order', 'createdAt'],
    },
    {
      fields: ['type', 'active', '_order', 'createdAt'],
    },
  ],
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
                    custom: {
                      cellWidth: '250px',
                    },
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
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'privateRegistrationNumber',
                  type: 'number',
                  label: 'ח.פ.',
                  index: true,
                  hasMany: true,
                  admin: {
                    condition: (data) => data?.type == 'regular',
                  },
                },
                {
                  name: 'parentCompany',
                  type: 'relationship',
                  label: 'חברת אם',
                  relationTo: 'companies',
                  index: true,
                  hasMany: false,
                  admin: {
                    custom: {
                      cellWidth: '100px',
                    },
                    disableListColumn: true,
                    width: '500px',
                    className: 'truncate',
                    allowCreate: false,
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
                  hooks: {
                    afterChange: [
                      async ({ req, siblingData, value, previousValue }) => {
                        try {
                          const added: string[] = []
                          const removed: string[] = []

                          const prev = Array.isArray(previousValue) ? previousValue : []
                          const curr = Array.isArray(value) ? value : []

                          // Determine additions and removals
                          for (const id of curr) if (!prev.includes(id)) added.push(id)
                          for (const id of prev) if (!curr.includes(id)) removed.push(id)

                          // Set parentCompany for added children
                          await Promise.all(
                            added.map((childId) =>
                              req.payload.update({
                                collection: 'companies',
                                id: String(childId),
                                data: { parentCompany: (siblingData as any)?.id },
                                req: { ...req, context: { ...req.context, from: 'relation-sync' } },
                              }),
                            ),
                          )

                          // Clear parentCompany for removed children if they still point to this parent
                          await Promise.all(
                            removed.map(async (childId) => {
                              try {
                                const child = await req.payload.findByID({
                                  collection: 'companies',
                                  id: String(childId),
                                  depth: 0,
                                })
                                if (child?.parentCompany === (siblingData as any)?.id) {
                                  await req.payload.update({
                                    collection: 'companies',
                                    id: String(childId),
                                    data: { parentCompany: null },
                                    req: {
                                      ...req,
                                      context: { ...req.context, from: 'relation-sync' },
                                    },
                                  })
                                }
                              } catch {}
                            }),
                          )
                        } catch (e) {
                          req?.payload?.logger?.warn?.(
                            { e },
                            'Failed to sync parentCompany on subCompanies change',
                          )
                        }
                      },
                    ],
                  },
                  admin: {
                    className: 'subCompanies',
                    condition: (data) => data?.type != 'fund',
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
                      label: 'קובץ המלצה אג"ח נאמנות ',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'showResearchBond',
                      label: 'קובץ המלצה אג"ח',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'showResearch',
                      label: 'קובץ המלצה כללי',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'showResearchPrivate',
                      label: 'קובץ מסמך מחקר פרטי',
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
                      name: 'displayVotingRecommendation',
                      label: 'הצגת המלצת הצבעה',
                      type: 'checkbox',
                      admin: {
                        width: '200px',
                      },
                    },
                    {
                      name: 'defaultVotingRecommendation',
                      label: 'עדכון ההמלצה בגלגלת ללקוח',
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
                    disableListColumn: true,
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
              maxRows: 1,
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
          label: 'משתמשים',
          admin: {
            condition: (data) => data?.type == 'regular',
          },
          fields: [
            {
              label: 'משתמשים בהרשאת כתיבה',
              type: 'join',
              collection: 'users',
              on: 'companies.companyId',
              name: 'usersWrite',
              admin: {
                disableListColumn: true,
              },
              where: {
                'companies.permission': { equals: 'write' },
              },
            },
            {
              label: 'משתמשים בהרשאת קריאה',
              type: 'join',
              collection: 'users',
              on: 'companies.companyId',
              name: 'usersRead',
              admin: {
                disableListColumn: true,
              },
              where: {
                'companies.permission': { equals: 'read' },
              },
            },
          ],
        },
        {
          label: 'החזקות תיק',
          admin: {
            condition: (data) => data?.type == 'fund',
          },
          fields: [
            {
              type: 'join',
              collection: 'holdings',
              on: 'fund',
              name: 'holdings',
              maxDepth: 0,
              admin: {
                disableListColumn: true,
              },
            },
          ],
        },
        {
          label: 'החזקות חברה',
          admin: {
            condition: (data) => data?.type == 'regular',
          },
          fields: [
            {
              label: 'החזקות חברה',
              type: 'join',
              collection: 'holdings',
              on: 'company',
              name: 'companyHoldings',
              defaultSort: ['fund', '-valueDate'],
              maxDepth: 0,
              // The `where` field expects a `Where` object, not a function.
              // Compute the date once at module load and pass the static object.
              where: ((): Where => {
                const now = new Date()
                const lastMonth = new Date(now)
                lastMonth.setMonth(now.getMonth() - 1)
                return {
                  valueDate: {
                    greater_than: lastMonth.toISOString(),
                  },
                }
              })(),
              admin: {
                disableListColumn: true,
                allowCreate: false,
                defaultColumns: ['fund', 'valueDate', 'stats.recordCount'],
              },
            },
          ],
        },
        {
          label: 'אסיפות',
          admin: {
            condition: (data) => data?.type == 'regular',
          },
          fields: [
            {
              label: 'אסיפות אליהן זומנה החברה',
              type: 'join',
              collection: 'meetings',
              on: 'companies',
              name: 'meetings',
              admin: {
                disableListColumn: true,
              },
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
        {
          name: 'label',
          label: 'תגיות',
          fields: [
            {
              name: 'labels',
              type: 'array',
              fields: [
                {
                  name: 'labelId',
                  label: 'מזהה תגית',
                  type: 'text',
                  admin: {
                    hidden: true,
                  },
                },
                {
                  name: 'label',
                  label: 'שם התגית',
                  type: 'text',
                },
                {
                  name: 'color',
                  label: 'צבע התגית',
                  type: 'text',
                },
                {
                  name: 'stock',
                  label: 'נייר ערך',
                  type: 'relationship',
                  relationTo: 'stocks',
                  hasMany: true,
                },
                {
                  name: 'companiesWithSameLabel',
                  label: 'חברות עם אותו תוית',
                  type: 'relationship',
                  relationTo: 'companies',
                  hasMany: true,
                },
              ],
            },
          ],
          hooks: {
            afterChange: [syncMeetingsOnCompanyChange],
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [beforeChangeCompanyId],
    afterChange: [
      async ({ doc, req, previousDoc, operation }) => {
        // Audit logging for company create/update
        try {
          if (!previousDoc) {
            // Create
            await logEvent({
              eventType: 'company.create',
              category: 'company',
              severity: 'info',
              targetCollection: 'companies',
              targetId: String(doc.id),
              message: `Company created: ${doc.name} (${doc.companyId ?? doc.id})`,
              details: { type: doc.type, active: doc.active },
              req,
              source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
            })
          } else {
            // Update - detect simple field changes
            const changes: string[] = []
            if (doc.name !== previousDoc.name) changes.push('name')
            if (doc.active !== previousDoc.active) changes.push('active')
            if (doc.type !== previousDoc.type) changes.push('type')
            if (JSON.stringify(doc.subCompanies) !== JSON.stringify(previousDoc.subCompanies))
              changes.push('subCompanies')
            if (JSON.stringify(doc.parentCompany) !== JSON.stringify(previousDoc.parentCompany))
              changes.push('parentCompany')

            if (changes.length > 0) {
              await logEvent({
                eventType: 'company.update',
                category: 'company',
                severity: 'info',
                targetCollection: 'companies',
                targetId: String(doc.id),
                message: `Company updated: ${doc.name} – fields changed: ${changes.join(', ')}`,
                details: { changes },
                req,
                source: (req as any)?.isAdminUI ? 'admin-ui' : 'rest',
              })
            }
          }
        } catch (e) {
          req?.payload?.logger?.warn?.({ e }, 'Failed to write company audit log')
        }

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

        // Invalidate active funds cache when relevant changes occur on funds
        try {
          const isFund = doc?.type === 'fund' || previousDoc?.type === 'fund'
          const activeChanged = previousDoc && doc?.active !== previousDoc?.active
          const typeChanged = previousDoc && doc?.type !== previousDoc?.type
          const createdOrDeleted = operation === 'create'
          if (isFund && (activeChanged || typeChanged || createdOrDeleted)) {
            // Invalidate so next run refreshes the cache
            await invalidateActiveFundsCache(req?.payload)
            req?.payload?.logger?.info?.('Invalidated active funds cache due to company change')
          }
        } catch (e) {
          req?.payload?.logger?.warn?.({ e }, 'Failed to invalidate active funds cache')
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
    {
      path: '/voting-recommendations',
      method: 'get',
      handler: getVotingRecommendation,
    },
    {
      path: '/createLabel',
      method: 'post',
      handler: addTagToCompany,
    },
    {
      path: '/deleteLabel',
      method: 'post',
      handler: deleteTagFromCompany,
    },
    {
      path: '/getLabels',
      method: 'post',
      handler: getLabelsForCompanies,
    },
    {
      path: '/updateLabel',
      method: 'post',
      handler: updateTagInCompany,
    },
  ],
}
