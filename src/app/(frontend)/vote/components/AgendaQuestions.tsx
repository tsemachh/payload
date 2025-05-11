'use client'
import type { AgendaQuestionsType } from '../../types/meetings'

interface AgendaQuestionsProps {
  questions: AgendaQuestionsType
  onChange: (questions: AgendaQuestionsType) => void
}

export default function AgendaQuestions({ questions, onChange }: AgendaQuestionsProps) {
  const handleChange = (question: keyof AgendaQuestionsType, value: boolean) => {
    onChange({
      ...questions,
      [question]: value,
    })
  }

  return (
    <div className="space-y-2 min-w-[200px] pl-3 pr-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">ניגוד עניינים </span>
        <div className="flex bg-muted rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleChange('hasConflictOfInterest', true)}
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
            onClick={() => handleChange('hasConflictOfInterest', false)}
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

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">צד קשור </span>
        <div className="flex bg-muted rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleChange('isRelatedParty', true)}
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
            onClick={() => handleChange('isRelatedParty', false)}
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

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">ועדות השקעות </span>
        <div className="flex bg-muted rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleChange('isInvestmentCommittee', true)}
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
            onClick={() => handleChange('isInvestmentCommittee', false)}
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

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">עניין אישי </span>
        <div className="flex bg-muted rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleChange('hasPersonalInterest', true)}
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
            onClick={() => handleChange('hasPersonalInterest', false)}
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
    </div>
  )
}
