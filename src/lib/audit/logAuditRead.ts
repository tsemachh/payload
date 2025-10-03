import type { PayloadRequest } from 'payload'

export type LogAuditReadArgs = {
  req: PayloadRequest
  mode: 'list' | 'document'
  filters?: any
  countReturned?: number
  documentId?: string
}

export async function logAuditRead({ req, mode, filters, countReturned, documentId }: LogAuditReadArgs) {
  const admin = (req as any)?.user?.id
  if (!admin) return
  try {
    const ip = (req as any)?.ip || (req as any)?.headers?.['x-forwarded-for'] || undefined
    const userAgent = (req as any)?.headers?.['user-agent']
    const requestId = (req as any)?.id || (req as any)?.headers?.['x-request-id']
    const source = (req as any)?.isAdminUI ? 'admin-ui' : 'rest'

    if (!req?.payload?.create) {
      req?.payload?.logger?.warn?.({}, 'Audit log read skipped: Payload instance not available on request')
      return
    }

    await req.payload.create({
      collection: 'audit-log-reads',
      data: {
        admin,
        mode,
        filters,
        countReturned,
        documentId,
        ip,
        userAgent,
        requestId,
        source,
      },
      overrideAccess: true,
    })
  } catch (e) {
    req?.payload?.logger?.warn?.({ e }, 'Failed to write audit-log-reads')
  }
}
