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
    voteReason: '',
    privilegedMajority: agenda.privilegedMajority,
    isRemovedFromAgenda: agenda.isRemovedFromAgenda,
  }))
}

export function isGeneralVote(votes: Vote[]): boolean {
  if (!votes || votes.length < 2) return true

  const ref = votes[0]
  const refVotes = ref.votes ?? []
  const refDynamicQuestions = ref.dynamicQuestions ?? []

  for (let i = 1; i < votes.length; i++) {
    const current = votes[i]
    const currentVotes = current.votes ?? []
    const currentDynamicQuestions = current.dynamicQuestions ?? []

    const generalFieldsToCompare: (keyof typeof ref)[] = [
      'isInterested',
      'interestedExplanation',
      'isSeniorOfficial',
      'seniorOfficialExplanation',
      'isInstitutionalInvestor',
      'clientComment',
      '_status',
    ]

    for (const field of generalFieldsToCompare) {
      const refVal = (ref as any)[field]
      const currentVal = (current as any)[field]
      const isStringField = [
        'interestedExplanation',
        'seniorOfficialExplanation',
        'clientComment',
        '_status',
      ].includes(field)
      if (isStringField) {
        if ((refVal || '') !== (currentVal || '')) {
          return false
        }
      } else {
        if (refVal !== currentVal) {
          return false
        }
      }
    }

    // Compare voteDocuments
    const refVoteDocuments = (ref.voteDocuments || []).map((doc) =>
      typeof doc === 'string' ? doc : doc.id,
    )
    const currentVoteDocuments = (current.voteDocuments || []).map((doc) =>
      typeof doc === 'string' ? doc : doc.id,
    )
    if (JSON.stringify(refVoteDocuments) !== JSON.stringify(currentVoteDocuments)) {
      return false
    }

    // Compare dynamic questions
    if (refDynamicQuestions.length !== currentDynamicQuestions.length) {
      return false
    }

    for (let j = 0; j < refDynamicQuestions.length; j++) {
      const refDq = refDynamicQuestions[j]
      const currentDq = currentDynamicQuestions[j]

      if (
        refDq.questionId !== currentDq.questionId ||
        refDq.answer !== currentDq.answer ||
        (refDq.explanation || '') !== (currentDq.explanation || '')
      ) {
        return false
      }
    }

    if (refVotes.length !== currentVotes.length) {
      return false
    }

    for (let j = 0; j < refVotes.length; j++) {
      const a = refVotes[j]
      const b = currentVotes[j]

      if (a.topicIndex !== b.topicIndex) {
        return false
      }

      const voteFieldsToCompare: (keyof typeof a)[] = [
        'topicIndex',
        'voteDecision',
        'voteReason',
        'hasConflictOfInterest',
        'isRelatedParty',
        'isInvestmentCommittee',
        'hasPersonalInterest',
        'conflictOfInterestExplanation',
        'relatedPartyExplanation',
        'personalInterestExplanation',
      ]

      for (const field of voteFieldsToCompare) {
        const aVal = (a as any)[field]
        const bVal = (b as any)[field]
        const isStringField = [
          'voteDecision',
          'voteReason',
          'conflictOfInterestExplanation',
          'relatedPartyExplanation',
          'personalInterestExplanation',
        ].includes(field)
        if (isStringField) {
          if ((aVal || '') !== (bVal || '')) {
            return false
          }
        } else {
          if (aVal !== bVal) {
            return false
          }
        }
      }
    }
  }

  return true
}
