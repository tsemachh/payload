import payload, { CollectionConfig } from 'payload'

type InitOptions = {
  collections: CollectionConfig[]
}

export const initPayloadTest = async (options: InitOptions) => {
  try {
    const config = {
      collections: options.collections,
      db: {
        url: process.env.MONGODB_URI || 'mongodb://localhost:27017/emda-test'
      }
    }

    await payload.init({
      config,
      secret: 'test-secret'
    })
  } catch (error) {
    if (!(error as any).message?.includes('already initialized')) {
      throw error
    }
  }

  return payload
}
