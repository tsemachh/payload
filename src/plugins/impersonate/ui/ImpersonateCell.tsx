'use client'
import type { DefaultCellComponentProps } from 'payload'
import { useAuth } from '@payloadcms/ui'
import React from 'react'
import { getLabels, SupportedLocale } from '../labels'
import { useLocale } from '../hooks/useLocale'

export const ImpersonateCell: React.FC<DefaultCellComponentProps> = (props) => {
  const {
    rowData: { id: idUser },
  } = props
  const { user: loggedInUser } = useAuth()
  const locale = useLocale()
  const labels = getLabels(locale as SupportedLocale)

  return (
    <>
      {loggedInUser?.id !== idUser && (
        <a
          href={`/api/users/${idUser}/impersonate`}
          style={{
            color: 'var(--theme-text)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          🎭 {labels.impersonate}
        </a>
      )}
    </>
  )
}
