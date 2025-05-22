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
    //hidden: true,
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
      //admin: { readOnly: true },
      hasMany: true,
      admin: {
        components: {
          Field:
            '/collections/research-documents/components/ResearchRelationshipValidationFilename',
        },
      },
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
