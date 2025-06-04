'use client'
import React, { useEffect, useState } from 'react'
import { useField, TextField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

const ConditionalReasonText: React.FC<TextFieldClientProps> = (props) => {
  console.log('props', props)
  const { path } = props

  const reasonRefPath = path.replace(/reasonText$/, 'reasonRef')

  const { value: reasonRef } = useField<{ content?: string } | string>({
    path: reasonRefPath,
  })

  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const checkReason = async () => {
      if (typeof reasonRef === 'string' && reasonRef) {
        // Fetch the recommendation-reasons document
        const response = await fetch(`/api/recommendation-reasons/${reasonRef}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        const reasonDoc = await response.json()
        setShouldShow(reasonDoc.content === 'אחר')
        
      } else if (typeof reasonRef === 'object' && reasonRef?.content) {
        setShouldShow(reasonRef.content === 'אחר')
      } else {
        setShouldShow(false)
      }
    }

    checkReason()
  }, [reasonRef])

  if (!shouldShow) return null

  return <TextField {...props} />
}

export default ConditionalReasonText
