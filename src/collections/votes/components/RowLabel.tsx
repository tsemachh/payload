'use client'
import { useRowLabel, useFormFields, useField } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { stringify } from 'qs-esm'

type RowLabelType = 'votes' | 'dynamicQuestions'

interface RowLabelProps {
  type?: RowLabelType
}

const RowLabel: React.FC<RowLabelProps> = ({ type = 'votes' }) => {
  const { rowNumber } = useRowLabel()
  const meetingId = useFormFields(([fields]) => fields.meeting?.value)

  // For votes - get topicIndex
  const { value: topicIndex } = useField<number>({
    path: `votes.${rowNumber}.topicIndex`,
  })

  // For dynamic questions - get questionText directly from the field
  const { value: questionText } = useField<string>({
    path: `dynamicQuestions.${rowNumber}.questionText`,
  })

  const [labelText, setLabelText] = useState('')
  const [isRemoved, setIsRemoved] = useState(false)

  const fetchAgendaText = async () => {
    try {
      const query = {
        where: { id: { equals: meetingId } },
        select: { agenda: true },
        depth: 0,
        limit: 1,
      }

      const stringifiedQuery = stringify(query, { addQueryPrefix: true })
      const response = await fetch(`/api/meetings${stringifiedQuery}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const agenda = data.docs[0]?.agenda || []
      const text = agenda[rowNumber as number]?.text || 'ללא תיאור'
      const isRemovedFromAgenda = agenda[rowNumber as number]?.isRemovedFromAgenda

      setLabelText(text)
      setIsRemoved(!!isRemovedFromAgenda)
    } catch (err) {
      console.error('Error fetching meeting:', err)
      setLabelText('שגיאה בטעינת נתונים')
    }
  }

  useEffect(() => {
    if (type === 'votes' && meetingId) {
      fetchAgendaText()
    } else if (type === 'dynamicQuestions' && questionText) {
      setLabelText(questionText)
    }
  }, [meetingId, rowNumber, type, questionText])

  // For dynamic questions, show simple label
  if (type === 'dynamicQuestions') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
        <span
          style={{
            flex: 1,
            marginRight: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {labelText || 'שאלה'}
        </span>
      </div>
    )
  }

  // For votes, show with topicIndex and removed status
  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: '100%' }}>
      <span style={{ marginRight: 4 }}>{topicIndex}.</span>

      <span
        style={{
          flex: 1,
          marginRight: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          ...(isRemoved && { textDecoration: 'line-through', color: 'gray' }),
        }}
      >
        {labelText}
      </span>

      {isRemoved && (
        <span
          style={{
            marginRight: 4,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            color: 'gray',
          }}
        >
          {'(הוסר מסדר היום)'}
        </span>
      )}
    </div>
  )
}

export default RowLabel
