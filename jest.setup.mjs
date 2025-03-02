const setup = () => {
  process.env.PAYLOAD_SECRET = 'TEST_SECRET'
  process.env.MONGODB_URI = 'mongodb://localhost:27017/emda-test'
  process.env.PAYLOAD_PUBLIC_SERVER_URL = 'http://localhost:3000'
  process.env.PAYLOAD_CONFIG_PATH = './src/payload.config.ts'
  process.env.NODE_ENV = 'test'

  jest.setTimeout(30000)
}

export default setup
