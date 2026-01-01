'use client'
import React from 'react'
import { useField } from '@payloadcms/ui'
import { formatDateTime } from '@/app/(frontend)/helpers/utils-data-table'

export const MeetingDate: React.FC = () => {
  const { value } = useField<string>({ path: 'meetingDate' })

  if (!value) return null

  return (
    <div>
      <span className="doc-controls__label">מועד האסיפה:</span>
      <span className="doc-controls__value">{formatDateTime(value)}</span>
    </div>
  )
}

export default MeetingDate
