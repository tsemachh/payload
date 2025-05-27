'use client'
import { FieldLabel, useField, useRowLabel } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import type { ArrayFieldLabelClientComponent } from 'payload'

export const SubjectLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<{ text: string }>()
  const [label, setLabel] = useState(`${rowNumber} נןשא`)
  const [originalText, setOriginalText] = useState('')

  useEffect(() => {
    if (data?.text) {
      // Store original text for tooltip and convert to uppercase for display
      setOriginalText(data.text)
      setLabel(`${rowNumber as number + 1}. ${data.text}`)
    } else {
      // Default label if header is not present
      setOriginalText('')
      setLabel(`${rowNumber}נןשא `)
    }
  }, [data, rowNumber])

  return (
    <div>
      <span 
        title={originalText} 
        style={{
          display: 'block',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {label}
      </span>
    </div>
  )
}

export const ArrayLabel: ArrayFieldLabelClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path: path })
  return <FieldLabel label={` ${field?.label}${typeof value != 'undefined'?'('+value+')':''}`} path={path} required={field?.required} />
}
