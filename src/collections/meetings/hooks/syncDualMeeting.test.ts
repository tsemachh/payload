import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { syncDualMeeting } from './syncDualMeeting'

// Mock Payload
vi.mock('payload', () => ({
  Payload: vi.fn(),
}))

describe('syncDualMeeting', () => {
  let mockPayload: any
  let consoleErrorSpy: any

  beforeEach(() => {
    mockPayload = {
      update: vi.fn().mockResolvedValue({}),
    }
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  describe('hasRelevantChanges', () => {
    it('should return false when no relevant fields have changed', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, currentDoc)

      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('should return true when type field changes', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('should return true when agenda changes', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [{ text: 'Item 1', topicType: 'GOVERNANCE' }],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [{ text: 'Item 2', topicType: 'GOVERNANCE' }],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('should return true when researchDocuments changes', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [{ id: 'doc-1', companies: [] }],
      }

      const previousDoc = {
        ...currentDoc,
        researchDocuments: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('should not sync when dualMeeting is not set', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: null,
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })

  describe('agenda synchronization', () => {
    it('should preserve existing agenda item properties when text matches', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [
          {
            text: 'Approve Financial Statements',
            topicType: 'FINANCIAL',
            result: 'APPROVED',
            isRemovedFromAgenda: false,
          },
        ],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [
          {
            text: 'Approve Financial Statements',
            topicType: 'FINANCIAL',
            result: 'PENDING',
            exceptionalRecommendation: {
              showExceptional: true,
              companies: ['COMPANY_A'],
            },
          },
        ],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedAgenda = updateCall[0].data.agenda

      expect(updatedAgenda[0]).toMatchObject({
        text: 'Approve Financial Statements',
        topicType: 'FINANCIAL',
        result: 'APPROVED',
        exceptionalRecommendation: {
          showExceptional: true,
          companies: ['COMPANY_A'],
        },
      })
    })

    it('should add exceptionalRecommendation to new agenda items', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [
          {
            text: 'New Agenda Item',
            topicType: 'GOVERNANCE',
            result: 'APPROVED',
          },
        ],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedAgenda = updateCall[0].data.agenda

      expect(updatedAgenda[0]).toMatchObject({
        text: 'New Agenda Item',
        exceptionalRecommendation: {
          showExceptional: false,
          companies: [],
        },
      })
    })

    it('should handle multiple agenda items with mixed new and existing', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [
          {
            text: 'Existing Item',
            topicType: 'FINANCIAL',
            result: 'APPROVED',
          },
          {
            text: 'New Item',
            topicType: 'GOVERNANCE',
            result: 'PENDING',
          },
        ],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [
          {
            text: 'Existing Item',
            topicType: 'FINANCIAL',
            result: 'REJECTED',
            exceptionalRecommendation: {
              showExceptional: true,
              companies: ['COMPANY_A'],
            },
          },
        ],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedAgenda = updateCall[0].data.agenda

      expect(updatedAgenda).toHaveLength(2)
      expect(updatedAgenda[0].exceptionalRecommendation).toEqual({
        showExceptional: true,
        companies: ['COMPANY_A'],
      })
      expect(updatedAgenda[1].exceptionalRecommendation).toEqual({
        showExceptional: false,
        companies: [],
      })
    })
  })

  describe('research documents synchronization', () => {
    it('should filter and sync only generic research documents', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [
          { id: 'doc-1', title: 'Generic Doc Updated', companies: [] },
          { id: 'doc-2', title: 'Company Specific', companies: ['COMPANY_A'] },
        ],
      }

      const previousDoc = {
        ...currentDoc,
        researchDocuments: [
          { id: 'doc-1', title: 'Generic Doc', companies: [] },
          { id: 'doc-3', title: 'Old Company Specific', companies: ['COMPANY_B'] },
        ],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updateData = updateCall[0].data

      // researchDocuments should be included because generic docs changed
      expect(updateData.researchDocuments).toBeDefined()
      expect(updateData.researchDocuments).toHaveLength(1)
      expect(updateData.researchDocuments[0].id).toBe('doc-1')
      expect(updateData.researchDocuments[0].title).toBe('Generic Doc Updated')
    })

    it('should not include researchDocuments in update when they have not changed', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [{ id: 'doc-1', title: 'Generic Doc', companies: [] }],
      }

      const previousDoc = {
        ...currentDoc,
      }

      // Change a different field to trigger sync
      currentDoc.state = 'INACTIVE'

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updateData = updateCall[0].data

      expect(updateData.researchDocuments).toBeUndefined()
    })

    it('should handle documents with undefined companies array', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [
          { id: 'doc-1', title: 'Doc without companies' },
          { id: 'doc-2', title: 'Doc with companies', companies: ['COMPANY_A'] },
        ],
      }

      const previousDoc = {
        ...currentDoc,
        researchDocuments: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedDocs = updateCall[0].data.researchDocuments

      expect(updatedDocs).toHaveLength(1)
      expect(updatedDocs[0].id).toBe('doc-1')
    })
  })

  describe('general fields synchronization', () => {
    it('should sync all general fields', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        primaryLegacyId: 'legacy-1',
        magnaId: 'magna-1',
        invitationLink: 'https://example.com/invite',
        invitationDocument: 'doc-id',
        state: 'ACTIVE',
        holdingsLimit: '2024-01-01',
        proxyVotingDate: '2024-01-15',
        meetingDate: '2024-02-01',
        location: 'Tel Aviv',
        comments: 'Test comments',
        resultsConfirmationStatus: 'CONFIRMED',
        electronicVotingEnabled: true,
        committeeInitiated: false,
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updateData = updateCall[0].data

      expect(updateData).toMatchObject({
        type: 'ANNUAL',
        magnaId: 'magna-1',
        invitationLink: 'https://example.com/invite',
        invitationDocument: 'doc-id',
        state: 'ACTIVE',
        holdingsLimit: '2024-01-01',
        proxyVotingDate: '2024-01-15',
        meetingDate: '2024-02-01',
        location: 'Tel Aviv',
        comments: 'Test comments',
        resultsConfirmationStatus: 'CONFIRMED',
        electronicVotingEnabled: true,
        committeeInitiated: false,
      })
    })
  })

  describe('migration comments', () => {
    it('should generate migration comments with changed fields', async () => {
      const currentDoc = {
        id: '1',
        primaryLegacyId: 'legacy-1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
        state: 'INACTIVE',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const migrationComments = updateCall[0].data.migrationComments

      expect(migrationComments).toContain('[sync]')
      expect(migrationComments).toContain('legacy-1')
      expect(migrationComments).toContain('סוג אסיפה')
      expect(migrationComments).toContain('מצב אסיפה')
    })

    it('should use document id when primaryLegacyId is not available', async () => {
      const currentDoc = {
        id: 'doc-123',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const migrationComments = updateCall[0].data.migrationComments

      expect(migrationComments).toContain('doc-123')
    })

    it('should include agenda in migration comments when agenda changes', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [{ text: 'New Item' }],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const migrationComments = updateCall[0].data.migrationComments

      expect(migrationComments).toContain('סדר יום')
    })

    it('should include research documents in migration comments when they change', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [{ id: 'doc-1', companies: [] }],
      }

      const previousDoc = {
        ...currentDoc,
        researchDocuments: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const migrationComments = updateCall[0].data.migrationComments

      expect(migrationComments).toContain('מסמכי מחקר')
    })
  })

  describe('payload update call', () => {
    it('should call payload.update with correct collection and id', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-123',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'meetings',
          id: 'dual-123',
        }),
      )
    })

    it('should include context with process information', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            from: 'process',
            process: 'syncDualMeeting',
          },
        }),
      )
    })
  })

  describe('error handling', () => {
    it('should catch and log errors without throwing', async () => {
      const error = new Error('Update failed')
      mockPayload.update.mockRejectedValueOnce(error)

      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await expect(syncDualMeeting(mockPayload, currentDoc, previousDoc)).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error syncing dual meeting:', error)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined previousDoc', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      await syncDualMeeting(mockPayload, currentDoc, undefined)

      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('should handle empty agenda arrays', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'SPECIAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedAgenda = updateCall[0].data.agenda

      expect(updatedAgenda).toEqual([])
    })

    it('should handle null values in fields', async () => {
      const currentDoc = {
        id: '1',
        type: null,
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        type: 'ANNUAL',
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('should handle complex nested agenda items', async () => {
      const currentDoc = {
        id: '1',
        type: 'ANNUAL',
        state: 'ACTIVE',
        dualMeeting: 'dual-1',
        agenda: [
          {
            text: 'Complex Item',
            topicType: 'GOVERNANCE',
            majorityType: 'SIMPLE',
            recommendation: 'FOR',
            percentResult: 85.5,
            result: 'APPROVED',
            isRemovedFromAgenda: false,
          },
        ],
        researchDocuments: [],
      }

      const previousDoc = {
        ...currentDoc,
        agenda: [
          {
            text: 'Complex Item',
            topicType: 'GOVERNANCE',
            majorityType: 'SIMPLE',
            recommendation: 'FOR',
            percentResult: 80.0,
            result: 'PENDING',
            exceptionalRecommendation: {
              showExceptional: true,
              companies: ['COMPANY_A', 'COMPANY_B'],
            },
          },
        ],
      }

      await syncDualMeeting(mockPayload, currentDoc, previousDoc)

      const updateCall = mockPayload.update.mock.calls[0]
      const updatedAgenda = updateCall[0].data.agenda

      expect(updatedAgenda[0]).toMatchObject({
        text: 'Complex Item',
        percentResult: 85.5,
        result: 'APPROVED',
        exceptionalRecommendation: {
          showExceptional: true,
          companies: ['COMPANY_A', 'COMPANY_B'],
        },
      })
    })
  })
})
