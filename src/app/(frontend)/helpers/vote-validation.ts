import { VoteDataType, ValidationError } from '../types/vote'

export function validateGeneralQuestions(
  votingData: VoteDataType,
  hasDynamicQuestions: boolean,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (hasDynamicQuestions) {
    // Validate dynamic questions
    votingData.dynamicQuestions?.forEach((dq) => {
      // If answer is true, explanation is required
      if (dq.answer && !dq.explanation?.trim()) {
        errors.push({
          field: `dynamicQuestion_${dq.questionId}`,
          message: 'נדרש הסבר',
          type: 'general',
        })
      }
    })
  } else {
    // Validate static general questions (old behavior)
    const generalData = votingData.generalVotingData

    if (generalData.isInterested && !generalData.interestedExplanation?.trim()) {
      errors.push({
        field: 'interestedExplanation',
        message: 'נדרש הסבר לעניין אישי',
        type: 'general',
      })
    }

    if (generalData.isSeniorOfficial && !generalData.seniorOfficialExplanation?.trim()) {
      errors.push({
        field: 'seniorOfficialExplanation',
        message: 'נדרש הסבר לנושא תפקיד בכיר',
        type: 'general',
      })
    }
  }

  return errors
}

export function validateAgendaQuestions(
  votingData: VoteDataType,
  meetingData: any,
): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate agenda items
  if (meetingData?.agendas) {
    meetingData.agendas.forEach((agenda: any) => {
      if (agenda.isRemovedFromAgenda) return

      const userVote = votingData.userVotes.find((v) => v.topicIndex === agenda.topicIndex)

      // Check if vote choice is selected
      if (!userVote?.choice) {
        errors.push({
          field: 'choice',
          message: 'יש לבחור הצבעה',
          type: 'agenda',
          topicIndex: agenda.topicIndex,
        })
      }

      // Check agenda question explanations
      if (userVote?.questions) {
        const questions = userVote.questions

        if (questions.hasConflictOfInterest && !questions.conflictOfInterestExplanation?.trim()) {
          errors.push({
            field: 'conflictOfInterestExplanation',
            message: 'נדרש הסבר לניגוד עניינים',
            type: 'agenda',
            topicIndex: agenda.topicIndex,
          })
        }

        if (questions.isRelatedParty && !questions.relatedPartyExplanation?.trim()) {
          errors.push({
            field: 'relatedPartyExplanation',
            message: 'נדרש הסבר לבעל עניין',
            type: 'agenda',
            topicIndex: agenda.topicIndex,
          })
        }

        if (questions.hasPersonalInterest && !questions.personalInterestExplanation?.trim()) {
          errors.push({
            field: 'personalInterestExplanation',
            message: 'נדרש הסבר לעניין אישי',
            type: 'agenda',
            topicIndex: agenda.topicIndex,
          })
        }
      }
    })
  }

  return errors
}

export function validateVoteData(meetingData: any, vote: any, hasDynamicQuestions: boolean): boolean {
  if (hasDynamicQuestions) {
    let hasDynamicQuestionError = false
    const voteDynamicQuestions = vote.dynamicQuestions || []

    for (const dq of voteDynamicQuestions) {
      // If answer is true, explanation is required
      if (dq.answer && !dq.explanation?.trim()) {
        hasDynamicQuestionError = true
        break
      }
    }

    if (hasDynamicQuestionError) {
      return false
    }
  } else {
    // Validate static general questions (old behavior)
    if (vote.isInterested && !vote.interestedExplanation?.trim()) {
      return false
    }

    if (vote.isSeniorOfficial && !vote.seniorOfficialExplanation?.trim()) {
      return false
    }
  }

  // Validate agenda items
  let hasAgendaError = false
  for (const agenda of meetingData.agendas) {
    if (agenda.isRemovedFromAgenda) continue

    const voteItem = (vote.votes || []).find((v: any) => v.topicIndex == agenda.topicIndex)

    if (!voteItem?.voteDecision) {
      hasAgendaError = true
      break
    }

    if (voteItem.hasConflictOfInterest && !voteItem.conflictOfInterestExplanation?.trim()) {
      hasAgendaError = true
      break
    }

    if (voteItem.isRelatedParty && !voteItem.relatedPartyExplanation?.trim()) {
      hasAgendaError = true
      break
    }

    if (voteItem.hasPersonalInterest && !voteItem.personalInterestExplanation?.trim()) {
      hasAgendaError = true
      break
    }
  }

  return !hasAgendaError
}
