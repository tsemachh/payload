import { Logtail } from '@logtail/browser'

let logtailInstance: Logtail | null = null

export const getLogtail = async (): Promise<Logtail> => {
  if (logtailInstance) {
    return logtailInstance
  }

  try {
    const response = await fetch('/api/config')
    const config = await response.json()

    if (!config.logtailToken) {
      throw new Error('Logtail token not found in config')
    }

    logtailInstance = new Logtail(config.logtailToken, {
      endpoint: config.logtailEndpoint || 'https://s1214463.eu-nbg-2.betterstackdata.com'
    })
    return logtailInstance
  } catch (error) {
    console.error('Failed to initialize Logtail:', error)
    throw error
  }
}

export const logger = {
  info: async (message: string, data?: any) => {
    try {
      const logtail = await getLogtail()
      logtail.info(message, data)
    } catch (error) {
      console.info(message, data)
    }
  },

  warn: async (message: string, data?: any) => {
    try {
      const logtail = await getLogtail()
      logtail.warn(message, data)
    } catch (error) {
      console.warn(message, data)
    }
  },

  error: async (message: string, data?: any) => {
    try {
      const logtail = await getLogtail()
      logtail.error(message, data)
    } catch (error) {
      console.error(message, data)
    }
  },

  debug: async (message: string, data?: any) => {
    try {
      const logtail = await getLogtail()
      logtail.debug(message, data)
    } catch (error) {
      console.debug(message, data)
    }
  }
}
