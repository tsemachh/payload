import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { isAdmin, isAdminOrSelf, userFields } from '@shefing/authorization'
import { createAdminNotification } from '@/utils/utils'
import { Company } from '@/payload-types'
import { TreeCompanyType } from '@/types/companies'

async function computeCompanyTreeAndLeafs(
  companyIds: string[],
  req: PayloadRequest,
): Promise<{
  funds: string[]
  treeCompanies: string
}> {
  // Query all companies and their nested subCompanies up to depth 4
  const companies = await req.payload.find({
    collection: 'companies',
    select: {
      mainAccount: false,
      silencedStocks: false,
      meetings: false,
      parentCompany: false,
      holdings: false,
      'subCompanies.id': true,
      'subCompanies.name': true,
    },
    populate: {
      companies: {
        subCompanies: true,
        name: true,
      },
    },
    where: {
      and: [
        {
          id: {
            in: companyIds,
          },
        },
        {
          // active: {
          //   equals: true,
          // },
        },
      ],
    },
    limit: 0,
    depth: 1,
  })

  // Compute leaf companies recursively
  const funds: string[] = []
  const processCompanies = (company: Partial<Company>): string[] => {
    const result: string[] = []

    // If company has an id, add it to the result
    if (company.id) {
      // Check if company has subCompanies
      if (!company.subCompanies || company.subCompanies.length === 0) {
        // This is a leaf company, add its ID
        result.push(company.id)
      } else {
        // Process subCompanies recursively
        company.subCompanies.forEach((subCompany: any) => {
          result.push(...processCompanies(subCompany))
        })
      }
    }

    return result
  }

  companies.docs.forEach((doc: any) => {
    funds.push(...processCompanies(doc))
  })

  const cleanCompanyTree = (company: any): TreeCompanyType => {
    return {
      id: company.id,
      name: company.name,
      subCompanies: (company.subCompanies || []).map((sub: Company) => cleanCompanyTree(sub)),
    }
  }

  // Apply to all top-level companies
  const cleanedTree: TreeCompanyType[] = companies.docs.map((doc: Company) => cleanCompanyTree(doc))
  return {
    funds: Array.from(new Set(funds)),
    treeCompanies: JSON.stringify(cleanedTree),
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'משתמשים',
    singular: 'משתמש',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'email',
    group: 'ניהול',
    defaultColumns: [
      'email',
      'name',
      'active',
      'companies',
      'isAdmin',
      'impersonate',
    ],
  },
  custom: {
    filterList: [
      ['active', 'isAdmin', 'createdAt'],
      ['enableAPIKey', 'receiveMailNotification'],
    ],
  },
  access: {
    // Only admins can create users
    create: isAdmin,
    // Admins can read all, but any other logged in user can only read themselves
    read: isAdminOrSelf,
    // Admins can update all, but any other logged in user can only update themselves
    update: isAdminOrSelf,
    // Only admins can delete
    delete: isAdmin,
  },
  auth: {
    useSessions: false,
    useAPIKey: true,
    tokenExpiration: process.env.NODE_ENV == 'production' ? 43200 : 432000, // 12 hours in prod, 5 days in dev timeout
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: 'שם משתמש',
          type: 'text',
        },

        {
          name: 'legacyId',
          label: 'מספר משתמש לגאסי',
          type: 'number',
          index: true,
        },
        {
          name: 'active',
          label: 'משתמש פעיל',
          type: 'checkbox',
          index: true,
        },
      ],
    },
    {
      name: 'companies',
      label: 'חברות',
      labels: {
        plural: 'חברות',
        singular: 'חברה',
      },
      type: 'array',
      validate: (value) => {
        if (!Array.isArray(value)) {
          return true // No companies selected, so valid
        }
        const ids = value.map((item) => {
          if (typeof item !== 'object' || item === null || !('companyId' in item)) {
            return null
          }
          return item.companyId
        })
        const filtered = ids.filter(Boolean)
        const unique = new Set(filtered)

        if (filtered.length !== unique.size) {
          return 'Each company can only be selected once.'
        }

        return true
      },
      interfaceName: 'UserCompany',
      fields: [
        {
          type: 'row',
          fields: [
            {
              label: 'חברה',
              name: 'companyId',
              maxDepth: 0,
              type: 'relationship',
              relationTo: 'companies',
              required: true,
              filterOptions: ({ data, siblingData, req }) => {
                if (req.context?.from == 'migration' || req.context?.from == 'process') return true
                const currentId = (siblingData as { companyId?: string })?.companyId

                const selectedIds = Array.isArray(data?.companies)
                  ? data.companies
                      .map((item: { companyId?: string }) => item?.companyId)
                      .filter((id: string | undefined) => id && id !== currentId)
                  : []
                const query: Where = {
                  type: {
                    equals: 'regular',
                  },
                  active: {
                    equals: true,
                  },
                }
                if (selectedIds.length === 0) {
                  return query
                }
                query.id = {
                  not_in: selectedIds,
                }
                return query
              },
            },
            {
              name: 'permission',
              label: 'הרשאה',
              type: 'select',
              options: [
                { label: 'צפיה בהצבעות ודוחות', value: 'read' },
                {
                  label: 'הזנת אחזקות והצבעה',
                  value: 'write',
                },
              ],
              defaultValue: 'write',
            },
          ],
        },
      ],
    },
    {
      name: 'funds',
      label: 'תיקים',
      type: 'relationship',
      relationTo: 'companies',
      maxDepth: 0,
      hasMany: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'treeCompanies',
      label: 'מבנה החברות כעץ מחרוזתי',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lastLogin',
          label: 'התחברות אחרונה',
          type: 'text',
        },
        {
          name: 'changePassword',
          label: 'שינוי סיסמה',
          type: 'checkbox',
          admin: { hidden: true },
        },
        {
          name: 'receiveMailNotification',
          label: 'קבלת התראות במייל',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'userIp',
      label: 'כתובות IP',
      type: 'text',
      admin: {
        description: 'הזן כתובות IP מופרדות בנקודה-פסיק (;)',
      },
    },

    {
      name: 'qrCodeData',
      label: 'נתוני QR',
      type: 'group',
      admin: {
        hidden: true,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'showQr',
              label: 'הצג QR',
              type: 'checkbox',
            },
            {
              name: 'createDate',
              label: 'תאריך יצירה',
              type: 'date',
            },
            {
              name: 'lastCodeFailureDate',
              label: 'תאריך כישלון אחרון',
              type: 'date',
            },
            {
              name: 'codeFailuresSinceLastSuccess',
              label: 'מספר כישלונות מאז הצלחה אחרונה',
              type: 'number',
            },
          ],
        },
      ],
    },
    ...userFields,
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        if (req.context.from == 'migration' || req.context.from == 'process') {
          return data
        }
        if (data?.companies) {
          const companiesChanged =
            originalDoc && JSON.stringify(originalDoc.companies) !== JSON.stringify(data?.companies)

          if (companiesChanged || !data?.funds || data?.funds.length === 0) {
            const companyIds = data?.companies.map((company: any) => company.companyId)
            const { funds, treeCompanies } = await computeCompanyTreeAndLeafs(companyIds, req)
            data.funds = funds
            data.treeCompanies = treeCompanies
          }
        }
        return data
      },
    ],
    beforeLogin: [
      async ({ user }) => {
        if (!user.active) {
          throw new APIError('המשתמש אינו פעיל, אנא פנה למנהל המערכת', 403)
        }
        return user
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        try {
          if (req.context.from == 'migration') return
          // Case 1: New user created
          if (operation === 'create') {
            await createAdminNotification(
              req.payload,
              `משתמש חדש נוצר: ${doc.email}`,
              'userCreated',
              `/admin/collections/users/${doc.id}`,
              undefined,
              doc.id,
            )
            return
          }

          // Case 2: User permissions changed
          if (operation === 'update' && previousDoc) {
            const changes = []

            // Check if active status changed
            if (doc.active !== previousDoc.active) {
              const status = doc.active ? 'פעיל' : 'לא פעיל'
              changes.push(`סטטוס שונה ל-${status}`)
            }

            // Check if isAdmin status changed
            if (doc.isAdmin !== previousDoc.isAdmin) {
              const status = doc.isAdmin ? 'מנהל' : 'לא מנהל'
              changes.push(`הרשאת מנהל שונתה ל-${status}`)
            }

            // Check if companies changed
            const companiesChanged =
              JSON.stringify(doc.companies) !== JSON.stringify(previousDoc.companies)
            if (companiesChanged) {
              changes.push('הרשאות חברות שונו')
            }

            // If any changes were detected, create a notification
            if (changes.length > 0) {
              await createAdminNotification(
                req.payload,
                `הרשאות משתמש שונו עבור ${doc.email}: ${changes.join(', ')}`,
                'userPermissionsChanged',
                `/admin/collections/users/${doc.id}`,
                undefined,
                doc.id,
              )
            }
          }
        } catch (error) {
          console.error('Error creating notification for user changes:', error)
        }
      },
    ],
  },
}
