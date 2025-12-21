import type { CollectionConfig } from 'payload'
import { beforeValidaCompaniesFromFilename, updateMeetingResearchStatus } from './hooks'
import { isAdmin, isUserCompanyResearchDoc } from '@/utils/authUtils'

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
    create: isAdmin,
    read: isUserCompanyResearchDoc,
    update: isAdmin,
    delete: isAdmin,
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
    // Temporarily disabled to debug file upload issues
    afterChange: [updateMeetingResearchStatus],
  },
}
