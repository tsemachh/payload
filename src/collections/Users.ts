import type { CollectionConfig } from 'payload'
import userFields from '@shefing/authorization/user-fields'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'משתמשים',
    singular: 'משתמש',
  },
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      label: 'שם משתמש',
      type: 'text',
    },
    ...userFields, // Email added by default
    // Add more fields as needed
  ],
}
