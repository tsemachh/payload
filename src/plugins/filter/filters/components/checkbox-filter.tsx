'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { CheckboxFilterState, Locale } from '@/types/filter-types'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface CheckboxFilterProps {
  label?: string
  checkboxLabel: string
  value?: CheckboxFilterState
  onChange: (state: CheckboxFilterState) => void
  locale?: Locale
  className?: string
}

export function CheckboxFilter({
  label,
  checkboxLabel,
  value = 'indeterminate',
  onChange,
  locale = { code: 'he', direction: 'rtl' },
  className,
}: CheckboxFilterProps) {
  const [internalState, setInternalState] = useState<CheckboxFilterState>(value)

  const isHebrew = locale.code === 'he'

  // Sync internal state with external value prop
  useEffect(() => {
    setInternalState(value)
  }, [value])

  const handleClick = () => {
    let newState: CheckboxFilterState

    switch (internalState) {
      case 'indeterminate':
        newState = 'checked'
        break
      case 'checked':
        newState = 'unchecked'
        break
      case 'unchecked':
        newState = 'indeterminate'
        break
      default:
        newState = 'indeterminate'
    }

    setInternalState(newState)
    onChange(newState)
  }

  const getCheckboxProps = () => {
    switch (internalState) {
      case 'checked':
        return { checked: true }
      case 'unchecked':
        return { checked: false }
      case 'indeterminate':
        return { checked: 'indeterminate' as const }
      default:
        return { checked: 'indeterminate' as const }
    }
  }

  const handleClear = () => {
    setInternalState('indeterminate')
    onChange('indeterminate')
  }

  return (
    <div className={cn('space-y-2', className)} dir={locale.direction}>
      {label && (
        <Label className={cn('text-sm font-medium', isHebrew && 'text-right block')}>{label}</Label>
      )}

      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded',
          (internalState === 'checked' || internalState === 'unchecked') &&
            'bg-gray-100 border border-gray-200',
          locale.direction === 'rtl' && 'justify-start',
        )}
      >
        <div className={cn('flex items-center', locale.direction === 'rtl' && 'order-first')}>
          <Checkbox
            id={`checkbox-${checkboxLabel}`}
            {...getCheckboxProps()}
            onCheckedChange={handleClick}
            className="cursor-pointer"
          />
        </div>

        {checkboxLabel && (
          <Label
            htmlFor={`checkbox-${checkboxLabel}`}
            className={cn(
              'cursor-pointer select-none',
              isHebrew && 'text-right',
              locale.direction === 'rtl' && 'order-2',
            )}
          >
            {checkboxLabel}
          </Label>
        )}

        {(internalState === 'checked' || internalState === 'unchecked') && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-4 w-4 p-0 hover:bg-muted-foreground/20',
              checkboxLabel
                ? locale.direction === 'rtl'
                  ? 'order-last'
                  : 'order-last'
                : locale.direction === 'rtl'
                  ? 'ml-[100px] order-last'
                  : 'mr-[100px] order-last',
            )}
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
