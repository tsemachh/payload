'use client'

import { useEffect, useState } from 'react'
import type { CheckboxFilterState } from '@/types/filter-types'

interface CheckboxFilterProps {
  value?: CheckboxFilterState
  onChange: (state: CheckboxFilterState) => void
}

export function CheckboxFilter({ value = 'indeterminate', onChange }: CheckboxFilterProps) {
  const [internalState, setInternalState] = useState<CheckboxFilterState>(value)
  const [tempState, setTempState] = useState<CheckboxFilterState>(value)

  useEffect(() => {
    setInternalState(value)
    setTempState(value)
  }, [value])

  const handleToggle = (newState: 'checked' | 'unchecked') => {
    setTempState(newState) // שמירת השינוי במצב זמני
  }

  const handleClear = () => {
    setTempState('indeterminate') // שמירת השינוי במצב זמני
  }

  const handleConfirm = () => {
    setInternalState(tempState) // עדכון המצב הפנימי
    onChange(tempState) // שליחת השינוי ל-Payload
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', direction: 'rtl' }}>
      <div
        style={{
          display: 'flex',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <button
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            border: 'none',
            backgroundColor: tempState === 'checked' ? '#16a34a' : 'white',
            color: tempState === 'checked' ? 'white' : '#6b7280',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => handleToggle('checked')}
          onMouseEnter={(e) => {
            if (tempState !== 'checked') {
              e.currentTarget.style.backgroundColor = '#f9fafb'
            }
          }}
          onMouseLeave={(e) => {
            if (tempState !== 'checked') {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          כן
        </button>
        <button
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            border: 'none',
            borderLeft: '1px solid #d1d5db',
            backgroundColor: tempState === 'unchecked' ? '#dc2626' : 'white',
            color: tempState === 'unchecked' ? 'white' : '#6b7280',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => handleToggle('unchecked')}
          onMouseEnter={(e) => {
            if (tempState !== 'unchecked') {
              e.currentTarget.style.backgroundColor = '#f9fafb'
            }
          }}
          onMouseLeave={(e) => {
            if (tempState !== 'unchecked') {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          לא
        </button>
      </div>

      {(tempState === 'checked' || tempState === 'unchecked') && (
        <button
          style={{
            width: '20px',
            height: '20px',
            padding: '0',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#6b7280',
          }}
          onClick={handleClear}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          ✕
        </button>
      )}

      <button
        style={{
          padding: '4px 12px',
          fontSize: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: '#16a34a',
          color: 'white',
          cursor: 'pointer',
        }}
        onClick={handleConfirm}
      >
        אישור
      </button>
    </div>
  )
}
