'use client'

import * as React from 'react'
import { useState, useEffect } from 'react'
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

  // Function to determine button classes based on state
  const getButtonClasses = (isSelected: boolean) => {
    const base = isAgendaQuestion ? agendaButtonClasses : commonButtonClasses

    // Read-only styles
    if (isReadOnly) {
      const selectedStyle = 'bg-primary/70 text-primary-foreground/80 cursor-not-allowed'
      const unselectedStyle = 'text-muted-foreground/50 bg-muted cursor-not-allowed'
      return `${base} ${isSelected ? selectedStyle : unselectedStyle}`
    }

    // Interactive styles
    const selectedStyle = 'bg-primary text-primary-foreground shadow-sm'
    const unselectedStyle = 'text-muted-foreground hover:bg-muted-foreground/10'
    return `${base} ${isSelected ? selectedStyle : unselectedStyle}`
  }

  return (
    <div>
      <div className={`flex items-center ${isAgendaQuestion ? 'justify-between' : ''}`}>
        <span className={`text-sm font-medium ml-2 ${isReadOnly ? 'text-muted-foreground' : ''}`}>
          {label}
        </span>
        <div className={`flex bg-muted rounded-full p-0.5 mr-2 ${isReadOnly ? 'opacity-75' : ''}`}>
          <button
            type="button"
            onClick={() => onValueChangeAction(true)}
            disabled={isReadOnly}
            className={getButtonClasses(currentValue === true)}
          >
            כן
          </button>
          <button
            type="button"
            onClick={() => onValueChangeAction(false)}
            disabled={isReadOnly}
            className={getButtonClasses(currentValue === false)}
          >
            לא
          </button>
        </div>
      </div>

      {showExplanation && (
        <div className={isAgendaQuestion ? 'mt-2' : 'mt-2'}>
          <Textarea
            placeholder={explanationPlaceholder || 'נא לפרט...'}
            className={`${isReadOnly && 'cursor-default'} ${
              isAgendaQuestion ? 'min-h-[60px] text-xs w-full' : 'min-h-[80px] text-sm'
            } ${
              hasExplanationError
                ? 'border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500'
                : 'border-input'
            }`}
            value={localExplanation}
            readOnly={isReadOnly}
            onChange={(e) => !isReadOnly && setLocalExplanation(e.target.value)}
            onBlur={() => !isReadOnly && onValueChangeAction(true, localExplanation)}
          />

          {hasExplanationError && <p className="text-red-500 text-xs mt-1">זהו שדה חובה</p>}
        </div>
      )}
    </div>
  )
}
