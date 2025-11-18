'use client'
import { FieldLabel, useField, useRowLabel } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { ArrayFieldLabelClientComponent } from 'payload'

export const SubjectLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<{ text: string; isRemovedFromAgenda: boolean }>()
  const [label, setLabel] = useState('')
  const [isRemoved, setIsRemoved] = useState(false)
  const [originalText, setOriginalText] = useState('')

  useEffect(() => {
    if (data?.text) {
      setOriginalText(data.text)
      setLabel(data.text)
      setIsRemoved(!!data.isRemovedFromAgenda)
    } else {
      setOriginalText('')
      setLabel('נושא')
      setIsRemoved(false)
    }
  }, [data])

  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
      <span style={{ marginRight: 4, marginLeft: 4 }}>
        {'נושא ' + ((rowNumber as number) + 1)}:
      </span>

      <span
        title={originalText}
        style={{
          flex: 1,
          display: 'block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(isRemoved && { textDecoration: 'line-through', color: 'gray' }),
        }}
      >
        {label}
      </span>

      {isRemoved && (
        <span style={{ color: 'gray', marginRight: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
          (הוסר מסדר היום)
        </span>
      )}
    </div>
  )
}

export const ArrayLabel: ArrayFieldLabelClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path: path })
  return (
    <FieldLabel
      label={` ${field?.label}${typeof value != 'undefined' ? '(' + value + ')' : ''}`}
      path={path}
      required={field?.required}
    />
  )
}
