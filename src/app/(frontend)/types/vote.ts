import { VoteDecision } from '../../../payload-types'

export type VoteDataType = {
  generalVotingData: GeneralVotingData
  userVotes: UserVote[]
  voterNotes: string
  voteDocuments: string[]
}

export type GeneralVotingData = {
  isInterested: boolean | null
  isSeniorOfficial: boolean | null
  isInstitutionalInvestor: boolean | null
  interestedExplanation?: string
  seniorOfficialExplanation?: string
}

export type UserVote = {
  topicIndex: number
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

// Utility type עבור שמות שדות ההסבר הכלליים
export type GeneralExplanationKeys = 'interestedExplanation' | 'seniorOfficialExplanation'

// Utility type עבור שמות שדות ההסבר של סדר יום
export type AgendaExplanationKeys =
  | 'conflictOfInterestExplanation'
  | 'relatedPartyExplanation'
  | 'personalInterestExplanation'

// Enums חדשים לשמות השדות במקום Type Unions
export enum GeneralQuestionId {
  IS_INTERESTED = 'isInterested',
  IS_SENIOR_OFFICIAL = 'isSeniorOfficial',
  IS_INSTITUTIONAL_INVESTOR = 'isInstitutionalInvestor',
}

export enum AgendaQuestionId {
  HAS_CONFLICT_OF_INTEREST = 'hasConflictOfInterest',
  IS_RELATED_PARTY = 'isRelatedParty',
  IS_INVESTMENT_COMMITTEE = 'isInvestmentCommittee',
  HAS_PERSONAL_INTEREST = 'hasPersonalInterest',
}

export type GeneralVotingIDs = `${GeneralQuestionId}`
export type AgendaVotingIDs = `${AgendaQuestionId}`

// Types for validation
export type ValidationError = {
  field: string
  message: string
  type: 'general' | 'agenda'
  topicIndex?: number
}
