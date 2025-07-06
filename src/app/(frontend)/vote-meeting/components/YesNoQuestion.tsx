'use client'

import * as React from 'react'
import { useState, useEffect } from 'react' // 👈 ADD THIS IMPORT
import { Textarea } from '@/components/ui/textarea'

interface YesNoQuestionProps {
  label: string
  currentValue: boolean | null
  explanationValue?: string
  explanationPlaceholder?: string
  requiresExplanation: boolean
  onValueChangeAction: (value: boolean, explanation?: string) => void
  isAgendaQuestion?: boolean
  hasExplanationError?: boolean
  isReadOnly?: boolean
}

export default function YesNoQuestion({
  label,
  currentValue,
  explanationValue,
  explanationPlaceholder,
  requiresExplanation,
  onValueChangeAction,
  isAgendaQuestion = false,
  hasExplanationError = false,
  isReadOnly = false,
}: YesNoQuestionProps) {
  const [localExplanation, setLocalExplanation] = useState(explanationValue || '')

  useEffect(() => {
    if (explanationValue !== localExplanation) {
      setLocalExplanation(explanationValue || '')
    }
  }, [explanationValue])

  const showExplanation = requiresExplanation && currentValue === true
  const commonButtonClasses = 'px-3 py-1 text-xs rounded-full transition-all'
  const agendaButtonClasses = 'px-2 py-0.5 text-xs rounded-full transition-all'

  return (
    <div>
      <div className={`flex items-center ${isAgendaQuestion ? 'justify-between' : ''}`}>
        <span className="text-sm font-medium ml-2">{label}</span>
        <div className="flex bg-muted rounded-full p-0.5 mr-2">
          <button
            type="button"
            onClick={() => onValueChangeAction(true)}
            className={`${isAgendaQuestion ? agendaButtonClasses : commonButtonClasses} ${
              currentValue === true
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10'
            }`}
          >
            כן
          </button>
          <button
            type="button"
            onClick={() => onValueChangeAction(false)}
            className={`${isAgendaQuestion ? agendaButtonClasses : commonButtonClasses} ${
              currentValue === false
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10'
            }`}
          >
            לא
          </button>
        </div>
      </div>

      {showExplanation && (
        <div className={isAgendaQuestion ? 'mt-2' : 'mt-2'}>
          <Textarea
            placeholder={explanationPlaceholder || 'נא לפרט...'}
            className={`${
              isAgendaQuestion ? 'min-h-[60px] text-xs w-full' : 'min-h-[80px] text-sm'
            } ${
              hasExplanationError
                ? 'border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500'
                : 'border-input'
            }`}
            value={localExplanation}
            disabled={isReadOnly}
            onChange={(e) => setLocalExplanation(e.target.value)}
            onBlur={() => onValueChangeAction(true, localExplanation)}
          />

          {hasExplanationError && <p className="text-red-500 text-xs mt-1">זהו שדה חובה</p>}
        </div>
      )}
    </div>
  )
}
