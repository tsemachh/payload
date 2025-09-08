import type { CollectionConfig } from 'payload'
import { beforeValidaCompaniesFromFilename } from './hooks'
import { isUserCompanyResearchDoc, isUserCompanyResearchDocWrite } from '@/utils/authUtils'

export const ResearchDocument: CollectionConfig = {
  slug: 'research-documents',
  labels: {
    plural: 'מסמכי מחקר',
    singular: 'מסמך מחקר',
  },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'company', 'uploadedAt'],
    listSearchableFields: ['filename', 'company'],
    group: 'מסמכים',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [[{ name: 'uploadedAt' }]],
    defaultFilter: { uploadedAt: 'last30Days' },
  },
  access: {
    // Only admins can create users
    create: isUserCompanyResearchDocWrite,
    // Admins can read all, but any other logged in user can only read themselves
    read: isUserCompanyResearchDoc,
    // Admins can update all, but any other logged in user can only update themselves
    update: isUserCompanyResearchDocWrite,
    // Only admins can delete
    delete: isUserCompanyResearchDocWrite,
  },
  upload: {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ],
    skipSafeFetch: true,
  },
  fields: [
    {
      name: 'companies',
      label: 'חברות',
      type: 'relationship',
      relationTo: 'companies',
      index: true,
      hasMany: true,
      admin: {
        allowCreate: false,
      },
      filterOptions: ({ req }: any) => {
        if (req.context?.from == 'migration' || req.context?.from == 'process') {
          return true
        }
        return {
          type: {
            equals: 'regular',
          },
          active: {
            equals: true,
          },
          'researchDocuments.showResearchPrivate': { equals: true }, //
        }
      },
    },
    {
      name: 'uploadedAt',
      label: 'תאריך העלאה',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'dd/MM/yyyy HH:mm',
          timeFormat: 'HH:mm',
        },

        components: {
          Field:
            '/collections/research-documents/components/ResearchRelationshipValidationFilename',
        },
        readOnly: true,
      },
      defaultValue: () => new Date(),
    },
  ],
  hooks: {
    beforeValidate: [beforeValidaCompaniesFromFilename],
  },
}
