import { PayloadRequest } from 'payload'

interface LogImpersonationStartParams {
  originalUser: any
  impersonateUserId: string
  req: PayloadRequest
}

interface LogImpersonationEndParams {
  originalUserId: string
}

export const logImpersonationStart = ({
  originalUser,
  impersonateUserId,
  req,
}: LogImpersonationStartParams) => {
  console.log(`🎭 Impersonation started:`, {
    originalUser: originalUser?.email,
    targetUser: impersonateUserId,
    timestamp: new Date().toISOString(),
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
  })
}

export const logImpersonationEnd = ({ originalUserId }: LogImpersonationEndParams) => {
  console.log(`✅ Impersonation ended:`, {
    returnedToUser: originalUserId,
    timestamp: new Date().toISOString(),
  })
}
