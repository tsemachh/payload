import { PayloadRequest } from 'payload'
import { User } from '@/payload-types'

export const sanitizeRequest = async (req: PayloadRequest): Promise<void> => {
  if (req?.user == null) {
    const res = await req.payload.find({
      collection: 'users',
      where: {
        email: { equals: 'system@shefing.com' },
      },
    })
    req.user = res.docs[0] as User & { collection: 'users' }
  }
}
