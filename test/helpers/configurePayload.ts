import { buildConfig } from 'payload/config'
import { Payload } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'

type InitOptions = {
  collections: any[]
}

export const initPayloadTest = async (options: InitOptions): Promise<Payload> => {
  const config = buildConfig({
    collections: options.collections,
    db: mongooseAdapter({
      url: process.env.MONGODB_URI || 'mongodb://localhost:27017/emda-test'
    }),
    typescript: {
      outputFile: '/dev/null'
    }
  })

  const payload = await new Payload({
    config,
    local: true,
    secret: process.env.PAYLOAD_SECRET || 'test-secret'
  })

  await payload.init()

  return payload
}