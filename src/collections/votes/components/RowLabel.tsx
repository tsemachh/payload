'use client'
import { useRowLabel, useFormFields, useField } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { stringify } from 'qs-esm'

const RowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel()
  const meetingId = useFormFields(([fields]) => fields.meeting?.value)

  const { value: topicIndex } = useField<number>({
    path: `votes.${rowNumber}.topicIndex`,
  })

  const [label, setLabel] = useState('')

  const fetchAgendaText = async () => {
    try {
      const query = {
        where: {
          id: {
            equals: meetingId,
          },
        },
        select: {
          agenda: true,
        },
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
      setLabel(`נושא ${topicIndex}: ${text}`)
    } catch (err) {
      console.error('Error fetching meeting:', err)
      setLabel(`נושא ${topicIndex}: שגיאה בטעינת נתונים`)
    }
  }

  useEffect(() => {
    if (meetingId) {
      fetchAgendaText()
    } else {
      setLabel(`נושא ${rowNumber}: אין אסיפה מקושרת`)
    }
  }, [meetingId, rowNumber])

  return (
    <div>
      <span>{label}</span>
    </div>
  )
}

export default RowLabel
