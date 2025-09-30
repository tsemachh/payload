import type { CollectionConfig } from 'payload'

export const AuditLogReads: CollectionConfig = {
  slug: 'audit-log-reads',
  labels: { singular: 'Audit Log Read', plural: 'Audit Log Reads' },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'mode',
    group: 'פעילות',
    defaultColumns: ['createdAt', 'admin', 'mode', 'countReturned', 'documentId', 'source'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  defaultSort: '-createdAt',
  access: {
    read: ({ req }) => !!req.user?.isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'admin', type: 'relationship', relationTo: 'users', required: true },
    { name: 'mode', type: 'select', required: true, options: ['list', 'document'].map((v) => ({ label: v, value: v })) },
    { name: 'filters', type: 'json' },
    { name: 'countReturned', type: 'number' },
    { name: 'documentId', type: 'text' },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'requestId', type: 'text' },
    { name: 'source', type: 'select', options: ['admin-ui', 'rest', 'local-api', 'cron', 'webhook'].map((v) => ({ label: v, value: v })) },
  ],
}
