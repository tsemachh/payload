'use client'

import React, { useEffect } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import { meetingTypeOptions } from '@/consts/otipns-const'

const TitleField: React.FC = () => {
  const { value, setValue } = useField<string>({ path: 'title' })
  const typeField = useFormFields(([fields]) => fields.type)
  useEffect(() => {
    if (!value && typeField?.value) {
      const typeOption = meetingTypeOptions.find((option) => option.value === typeField.value)
      if (typeOption) {
        setValue(`שאלות ${typeOption.label}`)
      }
    }
  }, [typeField?.value, value, setValue])

  return (
    <div className="field-type text">
      <label className="field-label" htmlFor="title">
        כותרת
      </label>
      <input
        id="title"
        name="title"
        type="text"
        value={value || ''}
        onChange={(e) => setValue(e.target.value)}
        className="field-input"
        placeholder="כותרת השאלות..."
      />
    </div>
  )
}

export default TitleField
