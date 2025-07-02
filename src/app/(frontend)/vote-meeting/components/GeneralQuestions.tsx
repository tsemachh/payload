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
}

export default function GeneralQuestions({
  generalVotingData,
  onQuestionChangeAction,
  getFieldErrorAction,
}: GeneralQuestionsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              isAgendaQuestion={false} // זהות לשאלות כלליות
              hasExplanationError={hasExplanationError}
            />
          )
        })}
      </div>
    </div>
  )
}
