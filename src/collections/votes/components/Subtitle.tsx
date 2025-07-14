'use client'

import React from 'react'
import type { BeforeDocumentControlsClientProps } from 'payload'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { useFormFields } from '@payloadcms/ui'

const SubTitle: BeforeDocumentControlsClientProps = () => {
  const fields = useFormFields(([f]) => f)

  const reported = fields.reported?.value
  const reportedBy = fields.reportedBy?.value
  const reportedTime = fields.reportedTime?.value

  const isValidTime =
    typeof reportedTime === 'string' ||
    typeof reportedTime === 'number' ||
    reportedTime instanceof Date

  const subTitle =
    reported && reportedBy && isValidTime
      ? `${reportedBy} דווח לרשות לפני ${formatDistanceToNow(new Date(reportedTime!), { locale: he })}`
      : 'לא דווח'

  return (
    <div
      style={{
        fontSize: '1.2rem',
        opacity: 0.95,
        marginBottom: '0.5rem',
        padding: '0.5rem 0',
      }}
    >
      {subTitle}
    </div>
  )
}
export default SubTitle
