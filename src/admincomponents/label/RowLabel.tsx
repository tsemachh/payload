'use client'
import { useRowLabel, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const RowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel()
  const agendaTexts = useFormFields(([fields]) => fields.agendaTexts?.value)

  const [label, setLabel] = useState('')

  useEffect(() => {
    if (agendaTexts && typeof agendaTexts === 'string' && typeof rowNumber === 'number') {
      const textsArray = agendaTexts.split(' ## ').filter(Boolean)
      const topicIndex = rowNumber

      if (textsArray[topicIndex]) {
        setLabel(`${(rowNumber as number) + 1}. ${textsArray[topicIndex]}`)
      } else {
        setLabel(`${rowNumber}נושא `)
      }
    }
  }, [agendaTexts, rowNumber])

  return (
    <div>
      <span>{label}</span>
    </div>
  )
}

export default RowLabel
