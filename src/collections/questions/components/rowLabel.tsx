'use client'
import { useEffect, useState } from 'react'
import { useField, useRowLabel } from '@payloadcms/ui'
import type { ArrayFieldLabelClientComponent } from 'payload'

interface QuestionRow {
  questionText: string
}

 const QuestionRowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<QuestionRow>()
  const [label, setLabel] = useState('')

  useEffect(() => {
    console.log("data",data)
    if (data?.questionText) {
      setLabel(data.questionText)
    } else {
      setLabel(`Question ${rowNumber !== undefined ? rowNumber + 1 : ''}`)
    }
  }, [data, rowNumber])

  return <span title={data?.questionText}>{label}</span>
}

export const QuestionsArrayLabel: ArrayFieldLabelClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path })
  return (
    <span>
       {value ? `(${value})` : ''}
    </span>
  )
}
export default QuestionRowLabel
