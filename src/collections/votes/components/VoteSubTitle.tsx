'use client'

import React from 'react'
import type { BeforeDocumentControlsClientProps } from 'payload'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { useFormFields } from '@payloadcms/ui'

const VoteSubTitle: BeforeDocumentControlsClientProps = () => {
  const fields = useFormFields(([f]) => f)

  const reported = fields.reported?.value
  const publisher = fields.publisher?.value
  const publishDate = fields.publishDate?.value
  const isValidTime =
    typeof publishDate === 'string' ||
    typeof publishDate === 'number' ||
    publishDate instanceof Date

  const subTitle =
    reported && publisher && isValidTime
      ? `${publisher} דווח לרשות לפני ${formatDistanceToNow(new Date(publishDate!), { locale: he })}`
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
export default VoteSubTitle
