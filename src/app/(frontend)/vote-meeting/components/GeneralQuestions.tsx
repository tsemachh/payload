'use client'

import {
  GeneralQuestionId,
  GeneralVotingData,
  GeneralVotingIDs,
  ValidationError,
} from '../../types/vote'
import { GENERAL_QUESTIONS_CONFIG, getExplanationFieldName } from '../questionConsts'
import YesNoQuestion from './YesNoQuestion'

interface GeneralQuestionsProps {
  generalVotingData: GeneralVotingData
  onQuestionChangeAction: (question: GeneralVotingIDs, value: boolean, explanation?: string) => void
  getFieldErrorAction: (
    fieldName: string,
    type: 'general',
    topicIndex?: number,
  ) => ValidationError | undefined
  isReadOnly?: boolean
  // Dynamic questions props
  dynamicQuestions?: Array<{
    id: string
    questionText: string
    answer: boolean
    explanation?: string
  }>
  onDynamicQuestionChange?: (questionId: string, answer: boolean, explanation?: string) => void
}

export default function GeneralQuestions({
  generalVotingData,
  onQuestionChangeAction,
  getFieldErrorAction,
  isReadOnly = false,
  dynamicQuestions,
  onDynamicQuestionChange,
}: GeneralQuestionsProps) {
  // If we have dynamic questions, show only them
  if (dynamicQuestions && dynamicQuestions.length > 0 && onDynamicQuestionChange) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {dynamicQuestions.map((question) => {
            const hasExplanationError = !!getFieldErrorAction(
              `dynamicQuestion_${question.id}`,
              'general',
            )
            return (
              <YesNoQuestion
                key={question.id}
                label={question.questionText}
                currentValue={question.answer}
                explanationValue={question.explanation}
                explanationPlaceholder="נא לפרט..."
                requiresExplanation={true}
                onValueChangeAction={(value, explanation) =>
                  onDynamicQuestionChange(question.id, value, explanation)
                }
                isAgendaQuestion={true}
                hasExplanationError={hasExplanationError}
                isReadOnly={isReadOnly}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Otherwise, show the default static questions
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {Object.values(GeneralQuestionId).map((questionId) => {
          const config = GENERAL_QUESTIONS_CONFIG[questionId]
          const explanationFieldName = getExplanationFieldName(questionId)
          const hasExplanationError = explanationFieldName
            ? !!getFieldErrorAction(explanationFieldName, 'general')
            : false

          return (
            <YesNoQuestion
              key={questionId}
              label={config.label}
              currentValue={generalVotingData[questionId]}
              explanationValue={
                explanationFieldName
                  ? (generalVotingData[explanationFieldName as keyof GeneralVotingData] as string)
                  : undefined
              }
              explanationPlaceholder={config.explanationPlaceholder}
              requiresExplanation={config.requiresExplanation}
              onValueChangeAction={(value, explanation) =>
                onQuestionChangeAction(questionId, value, explanation)
              }
              isAgendaQuestion={false}
              hasExplanationError={hasExplanationError}
              isReadOnly={isReadOnly}
            />
          )
        })}
      </div>
    </div>
  )
}
