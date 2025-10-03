import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/utils/authUtils'

export const AuditLogReads: CollectionConfig = {
  slug: 'audit-log-reads',
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'mode',
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [
      [{ name: 'createdAt' }],
      [{ name: 'admin' }, { name: 'mode' }],
      [{ name: 'countReturned' }, { name: 'documentId' }],
      [{ name: 'source' }],
    ],
  },
  defaultSort: '-createdAt',
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'admin', type: 'relationship', relationTo: 'users', required: true },
    { name: 'filters', type: 'json' },
    { name: 'countReturned', type: 'number' },
    { name: 'documentId', type: 'text' },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'requestId', type: 'text' },
  ],
}
