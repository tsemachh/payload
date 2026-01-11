import { describe, it, expect } from 'vitest'
import { calculateVoteStatuses } from './votesCountHooks'

describe('votesCountHooks', () => {
  describe('calculateVoteStatuses', () => {
    it('should return None/None when counts are zero', () => {
      const result = calculateVoteStatuses(0, 0, 10)
      expect(result.votesStatus).toBe('None')
      expect(result.votesReportStatus).toBe('None')
    })

    it('should return All/All when counts equal or exceed companies', () => {
      const result = calculateVoteStatuses(10, 10, 10)
      expect(result.votesStatus).toBe('All')
      expect(result.votesReportStatus).toBe('All')
    })

    it('should return Partial when some votes are missing', () => {
      const result = calculateVoteStatuses(5, 2, 10)
      expect(result.votesStatus).toBe('Partial')
      expect(result.votesReportStatus).toBe('Partial')
    })

    it('should return All for votesStatus when votes exceed companies', () => {
      const result = calculateVoteStatuses(12, 12, 10)
      expect(result.votesStatus).toBe('All')
      expect(result.votesReportStatus).toBe('All')
    })

    it('should handle zero companies gracefully', () => {
      const result = calculateVoteStatuses(5, 5, 0)
      expect(result.votesStatus).toBe('Partial') // Based on code logic: else { votesStatus = 'Partial' }
      expect(result.votesReportStatus).toBe('All')
    })
  })
})
