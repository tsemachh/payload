import type { CollectionConfig } from 'payload'
import { beforeValidaCompaniesFromFilename } from './hooks'

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
    group: 'אוספים משניים',
  },
  access: {
    admin: ({ req: { user } }) => {
      return Boolean(user)
    },
  },
  upload: {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ],
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
        components: {
          Field:
            '/collections/research-documents/components/ResearchRelationshipValidationFilename',
        },
      },
      // filterOptions: ({ data, siblingData }) => {
      //   console.log('-----siblingData', siblingData)
      //   console.log('----111data', data)

      //   return {
      //     subCompanies: {
      //       exists: false,
      //     },

      //     // parentCompany: { equals: true }, // הוסף את זה
      //   }
      // },
    },
    {
      name: 'uploadedAt',
      label: 'תאריך העלאה',
      type: 'date',
      admin: {
        date: {
          displayFormat: 'dd/MM/yyyy HH:mm',
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
