import { Vote, VoteDecision } from '@/payload-types'
import { MeetingTableDataType } from '../types/meetings'
import { UserVote } from '../types/vote'

export const fetcherVote = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || 'Failed to fetch data')
  }
  return res.json()
}

export const fetchMeetingData = async (url: string): Promise<MeetingTableDataType> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch meeting data')
  }
  const data = await response.json()
  if (data.data.length === 0) {
    throw new Error('No meeting data found')
  }
  return data.data[0]
}

export const fetchVotedCompanies = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.message || 'Failed to fetch data')
  }
  return res.json()
}

export const createDefaultAgendaQuestions = (
  agendas: MeetingTableDataType['agendas'],
  showDefaultRecommendations: boolean,
): UserVote[] => {
  return agendas.map((agenda) => ({
    topicIndex: agenda.topicIndex,
    choice: (agenda.recommendation.votingRecommendation && showDefaultRecommendations
      ? agenda.recommendation.votingRecommendation
      : '----') as VoteDecision,
    questions: {
      hasConflictOfInterest: false,
      isRelatedParty: false,
      isInvestmentCommittee: true,
      hasPersonalInterest: false,
      conflictOfInterestExplanation: '',
      relatedPartyExplanation: '',
      personalInterestExplanation: '',
    },
    privilegedMajority: agenda.privilegedMajority,
    isRemovedFromAgenda: agenda.isRemovedFromAgenda,
  }))
}

export function isGeneralVote(votes: Vote[]): boolean {
  if (!votes || votes.length < 2) return true

  const ref = votes[0]
  const refVotes = ref.votes ?? []

  for (let i = 1; i < votes.length; i++) {
    const current = votes[i]
    const currentVotes = current.votes ?? []

    const generalFieldsToCompare: (keyof typeof ref)[] = [
      'isInterested',
      'interestedExplanation',
      'isSeniorOfficial',
      'seniorOfficialExplanation',
      'isInstitutionalInvestor',
      'clientComment',
    ]

    for (const field of generalFieldsToCompare) {
      if ((ref as any)[field] !== (current as any)[field]) {
        console.log('-------', (ref as any)[field], ' - ', (current as any)[field])
        return false
      }
    }

    if (refVotes.length !== currentVotes.length) {
      console.log('-------', refVotes.length, ' - ', currentVotes.length)
      return false
    }

    for (let j = 0; j < refVotes.length; j++) {
      const a = refVotes[j]
      const b = currentVotes[j]

      if (a.topicIndex !== b.topicIndex) {
        console.log('-------', a.topicIndex, ' - ', b.topicIndex)

        return false
      }

      const voteFieldsToCompare: (keyof typeof a)[] = [
        'topicIndex',
        'voteDecision',
        'hasConflictOfInterest',
        'isRelatedParty',
        'isInvestmentCommittee',
        'hasPersonalInterest',
        'conflictOfInterestExplanation',
        'relatedPartyExplanation',
        'personalInterestExplanation',
      ]

      for (const field of voteFieldsToCompare) {
        if ((a as any)[field] !== (b as any)[field]) {
          console.warn()
          console.log('-------', (a as any)[field], ' - ', (b as any)[field])

          return false
        }
      }
    }
  }

  return true
}

export const shouldShowDefaultRecommendations = (
  selectedCompanies: string[],
  companiesWithDefaultRecommendationIds: Map<string, boolean>,
): boolean => {
  if (selectedCompanies.length === 0 || companiesWithDefaultRecommendationIds.size === 0) {
    return false
  }

  if (selectedCompanies.length > 1) {
    return true
  }

  if (selectedCompanies.length === 1) {
    const singleCompanyId = selectedCompanies[0]
    return companiesWithDefaultRecommendationIds.has(singleCompanyId)
  }

  return false
}
