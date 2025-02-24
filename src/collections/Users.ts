import type { CollectionConfig } from 'payload'
import { userFields } from '@shefing/authorization'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    plural: 'משתמשים',
    singular: 'משתמש',
  },
  admin: {
    useAsTitle: 'email',
    group:"ניהול"
  },
  auth: {
    useAPIKey: true,
    tokenExpiration: (process.env.NODE_ENV == "production")? 43200 : 432000 // 12 hours in prod, 5 days in dev timeout
  },
  fields: [
    {
      name: 'name',
      label: 'שם משתמש',
      type: 'text',
    },
    ...userFields,
  ],
}
