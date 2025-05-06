import type { CollectionConfig, PayloadRequest } from 'payload'
import { userFields } from '@shefing/authorization'
import type { Company } from '@/payload-types'
import { getCollectionDoc } from '@/utils/utils'

async function getLeafCompanies(company: Company | string, req: PayloadRequest): Promise<string[]> {
  let leafCompanies: string[] = []
  let theCompany: Company
  if (typeof company === 'string') {
    try {
      theCompany = (await getCollectionDoc(req, 'companies', company)) as Company
    } catch (e) {
      console.log('Error in getting company', e)
      return []
    }
  } else {
    theCompany = company as Company
  }
  if (theCompany.accounts && theCompany.accounts?.docs && theCompany.accounts?.docs?.length > 0) {
    //Companies with accounts
    leafCompanies.push(theCompany.id)
  } else {
    if (theCompany?.subCompanies)
      for (let i = 0; i < theCompany?.subCompanies.length; i++) {
        const subCompany = theCompany.subCompanies[i]
        leafCompanies = leafCompanies.concat(await getLeafCompanies(subCompany, req))
      }
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
      hasMany: true,
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            delete siblingData['allCompanies']
          },
        ],
        afterRead: [
          async ({ data, req }) => {
            let leafCompanies: string[] = []
            try {
              for (let i = 0; i < data?.companies?.length || 0; i++) {
                const company = data?.companies?.[i]
                const leafRecurseCompanies = await getLeafCompanies(company.companyId, req)
                leafCompanies = leafCompanies.concat(leafRecurseCompanies)
              }
            } catch (e: any) {
              console.error('Error in getLeafCompanies', JSON.stringify(e.message))
            }
            leafCompanies = Array.from(new Set(leafCompanies))
            return leafCompanies
          },
        ],
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
}
