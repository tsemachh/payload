import { Meeting } from '@/payload-types'

export function createMockMeeting(overrides: Partial<Meeting> = {}): Partial<Meeting> {
  return {
    id: `meeting_${Date.now()}`,
    fullName: 'Test Meeting',
    state: 'scheduled',
    meetingDate: new Date().toISOString(),
    holdingsLimit: new Date().toISOString(),
    type: 'שנתית',
    companies: [],
    votes: {
      docs: [],
      hasNextPage: false,
      totalDocs: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _status: 'published',
    ...overrides,
  }
}
