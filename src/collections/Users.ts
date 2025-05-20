import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { userFields } from '@shefing/authorization'
import { getIdOfRelationField } from '@/utils/utils'
import { Company } from '@/payload-types'

async function computeLeafCompanies(companyIds: any, req: PayloadRequest) {
  let leafCompanies: string[] = []
  const companies = await req.payload.find({
    collection: 'companies',
    select: {
      mainAccount: false,
      silencedStocks: false,
      meetings: false,
      parentCompany: false,
      holdings: false,
      'subCompanies.id': true,
      'subCompanies.subCompanies': true,
      'subCompanies.subCompanies.subCompanies': true,
      'subCompanies.subCompanies.subCompanies.subCompanies': true,
    },
    populate: {
      companies: {
        subCompanies: true,
      },
    },
    where: {
      id: {
        in: companyIds,
      },
    },
    limit: 0,
    depth: 5,
  })
  // go over the docs aggregate each Id in either in the root or in the subCompanies only if subCompanies are empty, store it in leafCompanies array
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

  // Process all companies in the docs array
  if (companies && companies.docs) {
    companies.docs.forEach((company: any) => {
      const companyLeafs = processCompanies(company)
      leafCompanies.push(...companyLeafs)
    })

    // Remove duplicates
    leafCompanies = Array.from(new Set(leafCompanies))
  }

  return leafCompanies
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
  },
  auth: {
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
              filterOptions: ({ data, siblingData }) => {
                const currentId = (siblingData as { companyId?: string })?.companyId

                const selectedIds = Array.isArray(data?.companies)
                  ? data.companies
                      .map((item: { companyId?: string }) => item?.companyId)
                      .filter((id: string | undefined) => id && id !== currentId)
                  : []

                if (selectedIds.length === 0) {
                  return true
                }

                return {
                  id: {
                    not_in: selectedIds,
                  },
                }
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
      name: 'leafCompanies',
      label: 'כל החברות עם החשבונות(כולל חברות בת)',
      type: 'relationship',
      relationTo: 'companies',
      maxDepth: 0,
      hasMany: true,
      admin: {
        readOnly: true,
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
        // Check if companies have changed by comparing with originalDoc
        const companiesChanged =
          originalDoc && JSON.stringify(originalDoc.companies) !== JSON.stringify(data?.companies)

        // Recalculate leafCompanies if companies have changed or if leafCompanies is empty
        if (companiesChanged || !data?.leafCompanies || data?.leafCompanies.length === 0) {
          const companyIds = data?.companies.map((company: any) =>
            getIdOfRelationField(company.companyId),
          )
          if (companyIds.length === 0) {
            return data
          }
          data.leafCompanies = await computeLeafCompanies(companyIds, req)
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
  },
}
