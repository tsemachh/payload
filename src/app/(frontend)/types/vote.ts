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
  choice: VoteChoice
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
export type VoteChoice = '----' | 'בעד' | 'נגד' | 'נמנע' | 'אין חובת השתתפות' | 'לא משתתף' | null

export type VoteCompanyType = {
  id: string
  name: string
}
