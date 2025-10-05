import { PayloadRequest } from 'payload'
import { logEvent } from '@/lib/audit/logEvent'

export function logImpersonationStart({
  originalUser,
  impersonateUserId,
  req,
}: {
  originalUser: any
  impersonateUserId: string
  req: PayloadRequest
}) {
  return logEvent({
    eventType: 'auth.impersonation.start',
    category: 'security',
    severity: 'high',
    actor: impersonateUserId,
    impersonator: originalUser?.id,
    success: true,
    message: `Admin ${originalUser?.email} impersonated user ${impersonateUserId}`,
    details: { impersonatorEmail: originalUser?.email, impersonatedUserId: impersonateUserId },
    req,
    source: 'admin-ui',
  })
}

export function logImpersonationEnd({
  originalUserId,
  req,
}: {
  originalUserId: string
  req: PayloadRequest
}) {
  return logEvent({
    eventType: 'auth.impersonation.end',
    category: 'security',
    severity: 'info',
    actor: originalUserId,
    success: true,
    message: `Impersonation ended; switched back to ${originalUserId}`,
    req,
    source: 'admin-ui',
  })
}
