'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'

interface OwnedQuantityInputProps {
  value: number | undefined
  verifiedHoldings: boolean | undefined | null
  onChange: (value: string) => void
  isVisible: boolean
}

export function OwnedQuantityInput({
  value,
  verifiedHoldings,
  onChange,
  isVisible,
}: OwnedQuantityInputProps) {
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Validate whenever value or verifiedHoldings changes
    if (verifiedHoldings === false) {
      if (!value || value <= 0 || isNaN(value)) {
        setError('שדה חובה')
      } else {
        setError('')
      }
    } else {
      setError('')
    }
  }, [value, verifiedHoldings])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div
      className="flex flex-col gap-1 h-[42.25px] justify-center"
      style={{
        visibility: isVisible ? 'visible' : 'hidden',
      }}
    >
      <Input
        value={value ? value.toLocaleString() : ''}
        onChange={handleChange}
        className={`text-right h-8 text-base dark:bg-gray-800 dark:text-white max-w-[100px] ${
          error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
        }`}
      />
      <span className="text-red-500 text-xs text-center max-w-[100px]">{error}</span>
    </div>
  )
}
