import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('DATABASE_URI', 'mongodb://localhost:27017/emda-test')
vi.stubEnv('NODE_ENV', 'test')
vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
