'use client'
import type { DefaultCellComponentProps } from 'payload'
import { useAuth } from '@payloadcms/ui'
import React from 'react'
import { getLabels, SupportedLocale } from '../labels'
import { useLocale } from '../hooks/useLocale'

interface ImpersonateCellProps extends DefaultCellComponentProps {
  clientProps?: {
    authCollection: string
  }
}

export const ImpersonateCell: React.FC<ImpersonateCellProps> = (props) => {
  const {
    rowData,
    clientProps,
  } = props

  const idUser = rowData.id
  const isAdmin = rowData.isAdmin as boolean | undefined
  const { user: loggedInUser } = useAuth()
  const locale = useLocale()
  const labels = getLabels(locale as SupportedLocale)

  // Get authCollection from clientProps or default to 'users'
  const authCollectionSlug = clientProps?.authCollection || 'users'

  // Only show impersonate link if:
  // 1. Current user is not the same as target user
  // 2. Current user is an admin
  // 3. Target user is not an admin
  const canImpersonate = 
    loggedInUser?.id !== idUser &&
    loggedInUser?.isAdmin && !isAdmin
  return (
    <>
      {canImpersonate && (
        <a
          href={`/api/${authCollectionSlug}/${idUser}/impersonate`}
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
