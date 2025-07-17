'use client'
import React, { useEffect, useState } from 'react'
import { TextField, useField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

const ConditionalReasonText: React.FC<TextFieldClientProps> = (props) => {
  const { path } = props

  const reasonRefPath = path.replace(/reasonText$/, 'reasonRef')

  const { value: reasonRef } = useField<string>({
    path: reasonRefPath,
  })

  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const checkReason = () => {
      if (reasonRef === 'אחר') {
        setShouldShow(true)
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
