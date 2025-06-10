'use client'
import { Textarea } from '../../components/ui/textarea'
import type { AgendaQuestionsType } from '../../types/vote'
interface AgendaQuestionsProps {
  questions: AgendaQuestionsType
  handleAgendaQuestionsChange: (
    subjectId:
      | 'hasConflictOfInterest'
      | 'isRelatedParty'
      | 'isInvestmentCommittee'
      | 'hasPersonalInterest',
    value: boolean,
    explanation?: string,
  ) => void
}
export default function AgendaQuestions({
  questions,
  handleAgendaQuestionsChange,
}: AgendaQuestionsProps) {
  // const handleChange = (question: keyof AgendaQuestionsType, value: boolean) => {
  //   const newQuestions = {
  //     ...questions,
  //     [question]: value,
  //   }
  //   onChangeAction(newQuestions)
  // }
  // const handleExplanationChange = (field: keyof AgendaQuestionsType, value: string) => {
  //   const newQuestions = {
  //     ...questions,
  //     [field]: value,
  //   }
  //   onChangeAction(newQuestions)
  // }
  return (
    <div className="space-y-3 min-w-[300px]">
      {/* שאלה 1: ניגוד עניינים */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">ניגוד עניינים </span>
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('hasConflictOfInterest', true)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.hasConflictOfInterest === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('hasConflictOfInterest', false)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.hasConflictOfInterest === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>

        {/* תיבת טקסט להסבר - מוצגת רק אם התשובה היא "כן" */}
        {questions.hasConflictOfInterest === true && (
          <Textarea
            placeholder="נא לפרט..."
            className="min-h-[60px] text-xs w-full"
            value={questions.conflictOfInterestExplanation || ''}
            onChange={(e) =>
              handleAgendaQuestionsChange('hasConflictOfInterest', true, e.target.value)
            }
          />
        )}
      </div>
      {/* שאלה 2: צד קשור */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">צד קשור </span>
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('isRelatedParty', true)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.isRelatedParty === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('isRelatedParty', false)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.isRelatedParty === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>
        {/* תיבת טקסט להסבר - מוצגת רק אם התשובה היא "כן" */}
        {questions.isRelatedParty === true && (
          <Textarea
            placeholder="נא לפרט..."
            className="min-h-[60px] text-xs"
            value={questions.relatedPartyExplanation || ''}
            onChange={(e) =>
              handleAgendaQuestionsChange('isRelatedParty', true, e.target.value)
            }
          />
        )}
      </div>
      {/* שאלה 3: ועדות השקעות */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">ועדת השקעות </span>
        <div className="flex bg-muted rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleAgendaQuestionsChange('isInvestmentCommittee', true)}
            className={`px-2 py-0.5 text-xs rounded-full transition-all ${
              questions.isInvestmentCommittee === true
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10'
            }`}
          >
            כן
          </button>
          <button
            type="button"
            onClick={() => handleAgendaQuestionsChange('isInvestmentCommittee', false)}
            className={`px-2 py-0.5 text-xs rounded-full transition-all ${
              questions.isInvestmentCommittee === false
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10'
            }`}
          >
            לא
          </button>
        </div>
      </div>
      {/* שאלה 4: עניין אישי */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">עניין אישי </span>
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('hasPersonalInterest', true)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.hasPersonalInterest === true
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => handleAgendaQuestionsChange('hasPersonalInterest', false)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all ${
                questions.hasPersonalInterest === false
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              }`}
            >
              לא
            </button>
          </div>
        </div>
        {/* תיבת טקסט להסבר - מוצגת רק אם התשובה היא "כן" */}
        {questions.hasPersonalInterest === true && (
          <Textarea
            placeholder="נא לפרט..."
            className="min-h-[60px] text-xs"
            value={questions.personalInterestExplanation || ''}
            onChange={(e) =>
              handleAgendaQuestionsChange('hasPersonalInterest', true, e.target.value)
            }
          />
        )}
      </div>
    </div>
  )
}
