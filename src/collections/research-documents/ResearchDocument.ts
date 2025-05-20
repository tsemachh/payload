import type {CollectionConfig } from 'payload'

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
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'],
  },
  fields: [
    {
      name: 'meeting',
      label: 'אסיפות',
      type: 'relationship',
      relationTo: 'meetings',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'companies',
      label: 'חברות',
      type: 'relationship',
      relationTo: 'companies',
      index: true,
      //admin: { readOnly: true },
      hasMany: true,
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
}
