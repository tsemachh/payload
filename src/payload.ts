import { initPayloadTest } from '@/test/helpers/configurePayload'
import { Accounts } from './collections/accounts/Accounts'
import { Firms } from './collections/firms/Firms'
import { Payload } from 'payload'

let cached: Payload | null = null

export const getPayload = async (): Promise<Payload> => {
  if (cached) return cached

  const payload = await initPayloadTest({
    // Pass collections that we want to register
    collections: [Accounts, Firms]
  })

  cached = payload
  return payload
}
