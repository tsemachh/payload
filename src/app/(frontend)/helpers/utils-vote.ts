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

export const createDefaultAgendaQuestions = (
  agendas: MeetingTableDataType['agendas'],
): UserVote[] => {
  return agendas.map((agenda) => ({
    topicIndex: agenda.topicIndex,
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
    privilegedMajority: agenda.privilegedMajority,
    isRemovedFromAgenda: agenda.isRemovedFromAgenda,
  }))
}
