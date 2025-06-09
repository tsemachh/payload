import { VoteDecision } from '@/payload-types'

export type VoteDataType = {
  generalVotingData: GeneralVotingData
  voterNotes: string
  userVotes: UserVote[]
}

export type GeneralVotingData = {
  isInterested: boolean | null
  isSeniorOfficial: boolean | null
  isInstitutionalInvestor: boolean | null
  interestedExplanation?: string
  seniorOfficialExplanation?: string
}
export type UserVote = {
  subjectId: string
  choice: VoteDecision
  questions: AgendaQuestionsType
}
export type AgendaQuestionsType = {
  hasConflictOf: boolean | null
  isRelatedParty: boolean | null
  isCommittee: boolean | null
  hasPersonalInterest: boolean | null
  conflictExplanation?: string
  relatedPartyExplanation?: string
  personalInterestExplanation?: string
}

export type VoteCompanyType = {
  id: string
  name: string
  percentageHolding: number
  holdingValueInMillions: number
  nominalValue: number
}
