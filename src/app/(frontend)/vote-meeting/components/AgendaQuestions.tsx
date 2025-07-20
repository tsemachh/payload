'use client'

import * as React from 'react'
import {
  AgendaQuestionId,
  AgendaQuestionsType,
  AgendaVotingIDs,
  ValidationError,
} from '../../types/vote'
import { AGENDA_QUESTIONS_CONFIG, getExplanationFieldName } from '../questionConsts'
import YesNoQuestion from './YesNoQuestion'

interface AgendaQuestionsProps {
  questions: AgendaQuestionsType
  handleAgendaQuestionsChangeAction: (
    subjectId: AgendaVotingIDs,
    value: boolean,
    explanation?: string,
  ) => void
  getFieldErrorAction: (
    fieldName: string,
    type: 'agenda',
    topicIndex: number,
  ) => ValidationError | undefined
  topicIndex: number
  isReadOnly?: boolean
}

export default function AgendaQuestions({
  questions,
  handleAgendaQuestionsChangeAction,
  getFieldErrorAction,
  topicIndex,
  isReadOnly = false,
}: AgendaQuestionsProps) {
  return (
    <div className="space-y-3 min-w-[300px]">
      {Object.values(AgendaQuestionId).map((questionId) => {
        const config = AGENDA_QUESTIONS_CONFIG[questionId]
        const explanationFieldName = getExplanationFieldName(questionId)
        const hasExplanationError = explanationFieldName
          ? !!getFieldErrorAction(explanationFieldName, 'agenda', topicIndex)
          : false

        return (
          <YesNoQuestion
            key={questionId}
            label={config.label}
            currentValue={questions[questionId]}
            explanationValue={
              explanationFieldName
                ? (questions[explanationFieldName as keyof AgendaQuestionsType] as string)
                : undefined
            }
            explanationPlaceholder={config.explanationPlaceholder}
            requiresExplanation={config.requiresExplanation}
            onValueChangeAction={(value, explanation) =>
              handleAgendaQuestionsChangeAction(questionId, value, explanation)
            }
            isAgendaQuestion={true}
            hasExplanationError={hasExplanationError}
            isReadOnly={isReadOnly}
          />
        )
      })}
    </div>
  )
}
