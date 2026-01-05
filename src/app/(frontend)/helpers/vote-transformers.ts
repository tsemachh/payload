import { VoteDataType, UserVote, DynamicQuestionAnswer } from '../types/vote'
import { createDefaultAgendaQuestions } from './utils-vote'

export interface VoteComparisonData {
  generalVotingData: {
    isInterested: boolean
    isSeniorOfficial: boolean
    isInstitutionalInvestor: boolean
    interestedExplanation: string
    seniorOfficialExplanation: string
  }
  voterNotes: string
  userVotes: Array<{
    topicIndex: number
    choice: UserVote['choice'] | null
    questions: {
      hasConflictOfInterest: boolean
      isRelatedParty: boolean
      isInvestmentCommittee: boolean
      hasPersonalInterest: boolean
      conflictOfInterestExplanation: string
      relatedPartyExplanation: string
      personalInterestExplanation: string
    }
    voteReason: string
  }>
  voteDocuments: string[]
  dynamicQuestions: Array<{
    questionId: string
    answer: boolean
    explanation: string
  }>
}

export function transformVoteToComparisonFormat(vote: any): VoteComparisonData {
  return {
    generalVotingData: {
      isInterested: vote.isInterested ?? false,
      isSeniorOfficial: vote.isSeniorOfficial ?? false,
      isInstitutionalInvestor: vote.isInstitutionalInvestor ?? true,
      interestedExplanation: vote.interestedExplanation || '',
      seniorOfficialExplanation: vote.seniorOfficialExplanation || '',
    },
    voterNotes: vote.clientComment || '',
    userVotes: (vote.votes || [])
      .map((v: any) => ({
        topicIndex: v.topicIndex,
        choice: v.voteDecision || null,
        questions: {
          hasConflictOfInterest: v.hasConflictOfInterest ?? false,
          isRelatedParty: v.isRelatedParty ?? false,
          isInvestmentCommittee: v.isInvestmentCommittee ?? true,
          hasPersonalInterest: v.hasPersonalInterest ?? false,
          conflictOfInterestExplanation: v.conflictOfInterestExplanation || '',
          relatedPartyExplanation: v.relatedPartyExplanation || '',
          personalInterestExplanation: v.personalInterestExplanation || '',
        },
        voteReason: v.voteReason || '',
      }))
      .sort((a: any, b: any) => a.topicIndex - b.topicIndex),
    voteDocuments: (vote.voteDocuments || [])
      .map((doc: any) => (typeof doc === 'object' ? doc.id : doc))
      .sort(),
    dynamicQuestions: (vote.dynamicQuestions || []).sort((a: any, b: any) =>
      a.questionId.localeCompare(b.questionId),
    ),
  }
}

export function createInitialVoteData(
  meetingData: any,
  fetchedVotes: any[],
  publishedVotes: any[],
): {
  initialData: VoteDataType
  publishedData: VoteDataType | null
  uploadedDocs: any[]
  lastPublishedVoteInfo: { user: string; date: Date } | undefined
} {
  // Initialize dynamic questions from meeting data
  const dynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions?.questions
    ? meetingData.relatedQuestions.questions.map((q: any) => {
        return {
          questionId: q.id,
          questionText: q.questionText,
          answer: q.defaultValue || false,
          explanation: '',
        }
      })
    : []

  let initialData: VoteDataType
  let publishedData: VoteDataType | null = null
  let uploadedDocs: any[] = []
  let lastPublishedVoteInfo: { user: string; date: Date } | undefined

  if (!fetchedVotes || fetchedVotes.length === 0) {
    initialData = {
      generalVotingData: {
        isInterested: false,
        isSeniorOfficial: false,
        isInstitutionalInvestor: true,
      },
      voterNotes: '',
      userVotes: createDefaultAgendaQuestions(
        meetingData.agendas,
        meetingData.defaultVotingRecommendation,
      ),
      voteDocuments: [],
      dynamicQuestions,
    }
  } else {
    // Case where we have fetched votes
    if (!publishedVotes || !publishedVotes.length) {
      lastPublishedVoteInfo = undefined
    } else {
      lastPublishedVoteInfo = {
        user: publishedVotes[0].publisher || '',
        date: publishedVotes[0].updatedAt || ' לא ידוע',
      }
    }

    const firstVote = fetchedVotes[0]
    if (firstVote.voteDocuments && Array.isArray(firstVote.voteDocuments)) {
      uploadedDocs = firstVote.voteDocuments.filter(
        (doc: { id: any }) => typeof doc === 'object' && doc.id,
      )
    } else {
      uploadedDocs = []
    }

    // Load dynamic questions answers from saved vote
    const savedDynamicQuestions: DynamicQuestionAnswer[] = meetingData.relatedQuestions?.questions
      ? meetingData.relatedQuestions.questions.map((q: any) => {
          const savedAnswer = firstVote.dynamicQuestions?.find((dq: any) => dq.questionId === q.id)
          return {
            questionId: q.id,
            questionText: q.questionText,
            answer: savedAnswer?.answer ?? (q.defaultValue || false),
            explanation: savedAnswer?.explanation || '',
          }
        })
      : []

    initialData = {
      generalVotingData: {
        isInterested: firstVote.isInterested ?? false,
        isSeniorOfficial: firstVote.isSeniorOfficial ?? false,
        isInstitutionalInvestor: firstVote.isInstitutionalInvestor ?? true,
        interestedExplanation: firstVote.interestedExplanation || '',
        seniorOfficialExplanation: firstVote.seniorOfficialExplanation || '',
      },
      voterNotes: firstVote.clientComment || '',
      userVotes: transformFetchedVotesToUserVotes(meetingData.agendas, firstVote),
      voteDocuments: Array.isArray(firstVote.voteDocuments)
        ? firstVote.voteDocuments.map((doc: { id: any }) => doc.id)
        : [],
      dynamicQuestions: savedDynamicQuestions,
    }
  }

  if (publishedVotes && publishedVotes.length > 0) {
    const firstPublishedVote = publishedVotes[0]

    // Load published dynamic questions answers
    const publishedDynamicQuestions = meetingData.relatedQuestions?.questions
      ? meetingData.relatedQuestions.questions.map((q: any) => {
          const savedAnswer = firstPublishedVote.dynamicQuestions?.find(
            (dq: any) => dq.questionId === q.id,
          )
          return {
            questionId: q.id,
            questionText: q.questionText,
            answer: savedAnswer?.answer ?? (q.defaultValue || false),
            explanation: savedAnswer?.explanation || '',
          }
        })
      : []

    publishedData = {
      generalVotingData: {
        isInterested: firstPublishedVote.isInterested ?? false,
        isSeniorOfficial: firstPublishedVote.isSeniorOfficial ?? false,
        isInstitutionalInvestor: firstPublishedVote.isInstitutionalInvestor ?? true,
        interestedExplanation: firstPublishedVote.interestedExplanation || '',
        seniorOfficialExplanation: firstPublishedVote.seniorOfficialExplanation || '',
      },
      voterNotes: firstPublishedVote.clientComment || '',
      userVotes: transformFetchedVotesToUserVotes(meetingData.agendas, firstPublishedVote),
      voteDocuments: Array.isArray(firstPublishedVote.voteDocuments)
        ? firstPublishedVote.voteDocuments.map((doc: { id: any }) => doc.id)
        : [],
      dynamicQuestions: publishedDynamicQuestions,
    }
  }

  return { initialData, publishedData, uploadedDocs, lastPublishedVoteInfo }
}

function transformFetchedVotesToUserVotes(agendas: any[], vote: any): UserVote[] {
  return agendas.map((agenda) => {
    const voteItem = (vote.votes || []).find((v: any) => v.topicIndex == agenda.topicIndex)
    return {
      topicIndex: agenda.topicIndex,
      choice: voteItem?.voteDecision || '',
      questions: {
        hasConflictOfInterest: voteItem?.hasConflictOfInterest ?? false,
        isRelatedParty: voteItem?.isRelatedParty ?? false,
        isInvestmentCommittee: voteItem?.isInvestmentCommittee ?? true,
        hasPersonalInterest: voteItem?.hasPersonalInterest ?? false,
        conflictOfInterestExplanation: voteItem?.conflictOfInterestExplanation || '',
        relatedPartyExplanation: voteItem?.relatedPartyExplanation || '',
        personalInterestExplanation: voteItem?.personalInterestExplanation || '',
      },
      voteReason: voteItem?.voteReason || '',
      privilegedMajority: agenda.privilegedMajority,
      isRemovedFromAgenda: agenda.isRemovedFromAgenda,
    }
  })
}
