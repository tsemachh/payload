import type { PayloadRequest } from 'payload'

export type AuditEvent = {
  eventType:
    | 'auth.login.success'
    | 'auth.login.failure'
    | 'auth.logout'
    | 'auth.impersonation.start'
    | 'auth.impersonation.end'
    | 'user.create'
    | 'user.update'
    | 'company.create'
    | 'company.update'
    | 'access.denied'
  severity?: 'info' | 'warning' | 'high' | 'critical'
  category?: 'security' | 'auth' | 'user' | 'company' | 'ops' | 'system'
  actor?: string | null
  impersonator?: string | null
  targetCollection?: string
  targetId?: string
  success?: boolean
  message?: string
  details?: any
  req: PayloadRequest
  source?: 'rest' | 'admin-ui' | 'local-api' | 'cron' | 'webhook'
}

export async function logEvent(e: AuditEvent) {
  const {
    eventType,
    severity = 'info',
    category = 'security',
    actor,
    impersonator,
    targetCollection,
    targetId,
    success = true,
    message,
    details,
    req,
    source = 'local-api',
  } = e

  try {
    const ip = (req as any)?.ip || (req as any)?.headers?.['x-forwarded-for'] || undefined
    const userAgent = (req as any)?.headers?.['user-agent']
    const requestId = (req as any)?.id || (req as any)?.headers?.['x-request-id']

    if (!req?.payload?.create) {
      req?.payload?.logger?.warn?.({}, 'Audit log skipped: Payload instance not available on request')
      return
    }

    await req.payload.create({
      collection: 'audit-logs',
      data: {
        eventType,
        severity,
        category,
        actor: actor || (req as any)?.user?.id || null,
        impersonator: impersonator || null,
        targetCollection,
        targetId,
        success,
        message,
        details,
        ip,
        userAgent,
        requestId,
        source,
      },
      overrideAccess: true,
      // ensure no side-effects like emails
      disableVerificationEmail: true as any,
    })
  } catch (err) {
    // Never throw from audit logging
    req?.payload?.logger?.warn?.({ err }, 'Failed to write audit log')
  }
}
