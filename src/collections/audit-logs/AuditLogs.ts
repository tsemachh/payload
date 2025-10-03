import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/utils/authUtils'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: { singular: 'יומן ביקורת', plural: 'יומני ביקורת' },
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'message',
    group: 'ניהול',
    defaultColumns: ['message', 'createdAt', 'severity', 'eventType', 'actor', 'details'],
    pagination: {
      defaultLimit: 100,
      limits: [10, 20, 50, 100, 200, 500],
    },
  },
  custom: {
    filterList: [
      [{ name: 'createdAt' }, { name: 'success' }, { name: 'source' }],
      [{ name: 'severity' }, { name: 'eventType' }, { name: 'category' }],
      [{ name: 'actor' }, { name: 'targetCollection' }, { name: 'targetId' }],
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
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        'auth.login.success',
        'auth.login.failure',
        'auth.logout',
        'auth.impersonation.start',
        'auth.impersonation.end',
        'user.create',
        'user.update',
        'company.create',
        'company.update',
        'access.denied',
      ].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: ['info', 'warning', 'high', 'critical'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'security',
      options: ['security', 'auth', 'user', 'company', 'ops', 'system'].map((v) => ({
        label: v,
        value: v,
      })),
    },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'impersonator', type: 'relationship', relationTo: 'users' },
    { name: 'targetCollection', type: 'text' },
    { name: 'targetId', type: 'text' },
    { name: 'success', type: 'checkbox', defaultValue: true },
    { name: 'message', type: 'text' },
    { name: 'details', type: 'json' },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'requestId', type: 'text' },
    {
      name: 'source',
      type: 'select',
      options: ['rest', 'admin-ui', 'local-api', 'cron', 'webhook'].map((v) => ({
        label: v,
        value: v,
      })),
    },
  ],
  hooks: {
    afterOperation: [
      async ({ operation, req, result, args, collection }) => {
        try {
          // Only track reads of the audit-logs collection
          if (collection?.slug !== 'audit-logs') return
          if (!req?.user?.isAdmin) return
          // Internal guard
          if (req?.context?.__skipAuditReadLog) return

          // Determine mode and details
          if (operation === 'find') {
            const countReturned: number | undefined =
              (result as any)?.totalDocs ??
              (Array.isArray((result as any)?.docs) ? (result as any).docs.length : undefined)
            const { where, sort, limit, page } = (req?.query as any) || {}
            await import('../../lib/audit/logAuditRead').then(({ logAuditRead }) =>
              logAuditRead({
                req,
                mode: 'list',
                filters: { where, sort, limit, page },
                countReturned,
              }),
            )
          } else if (operation === 'findByID') {
            const id = (args as any)?.id
            await import('../../lib/audit/logAuditRead').then(({ logAuditRead }) =>
              logAuditRead({ req, mode: 'document', documentId: id }),
            )
          }
        } catch (e) {
          req?.payload?.logger?.warn?.({ e }, 'Failed to log audit-log read')
        }
      },
    ],
  },
}
