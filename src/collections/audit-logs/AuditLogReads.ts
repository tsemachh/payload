import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/utils/authUtils'

export const AuditLogReads: CollectionConfig = {
  slug: 'audit-log-reads',
  labels: { singular: 'קריאת יומן ביקורת', plural: 'קריאות יומן ביקורת' },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'mode',
    group: 'ניהול',
    defaultColumns: [
      'message',
      'createdAt',
      'admin',
      'mode',
      'countReturned',
      'documentId',
      'source',
    ],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [[{ name: 'createdAt' }]],
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
    {
      name: 'mode',
      type: 'select',
      required: true,
      options: ['list', 'document'].map((v) => ({ label: v, value: v })),
    },
    { name: 'filters', type: 'json' },
    { name: 'countReturned', type: 'number' },
    { name: 'documentId', type: 'text' },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'requestId', type: 'text' },
    {
      name: 'source',
      type: 'select',
      options: ['admin-ui', 'rest', 'local-api', 'cron', 'webhook'].map((v) => ({
        label: v,
        value: v,
      })),
    },
  ],
}
