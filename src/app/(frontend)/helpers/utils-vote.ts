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

export const createDefaultAgendaQuestions = (
  agendas: MeetingTableDataType['agendas'],
): UserVote[] => {
  return agendas.map((agenda) => ({
    subjectId: agenda.id,
    choice: '----',
    questions: {
      hasConflictOfInterest: false,
      isRelatedParty: false,
      isInvestmentCommittee: true,
      hasPersonalInterest: false,
      conflictOfInterestExplanation: undefined,
      relatedPartyExplanation: undefined,
      personalInterestExplanation: undefined,
      investmentCommitteeExplanation: undefined,
    },
  }))
}
