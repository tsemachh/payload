import { vi } from 'vitest'

export function createMockPayload() {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'new_id', ...args.data })),
    update: vi.fn().mockImplementation((args) => Promise.resolve({ id: args.id, ...args.data })),
    delete: vi.fn().mockResolvedValue({ id: 'deleted_id' }),
    db: {
      collections: {},
    },
    config: {
      collections: [],
    },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }
}
