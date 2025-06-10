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
  hasConflictOfInterest: boolean | null
  isRelatedParty: boolean | null
  isInvestmentCommittee: boolean | null
  hasPersonalInterest: boolean | null
  conflictOfInterestExplanation?: string
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
