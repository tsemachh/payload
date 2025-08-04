'use client'
import type { DefaultCellComponentProps, OptionObject, SelectFieldClient } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { optionsAreObjects } from 'payload/shared'
import React from 'react'

import { DefaultCell, useTranslation } from '@payloadcms/ui'

export interface SelectCellProps extends DefaultCellComponentProps<SelectFieldClient> {}

export const TruncatedSelectCell: React.FC<SelectCellProps> = (props) => {
  const { i18n } = useTranslation()
  const {
    cellData,
    field: { options, admin },
  } = props
  const width = admin?.custom?.cellWidth
    ? admin?.custom?.cellWidth
    : admin?.width
      ? admin.width
      : 'auto'

  const findLabel = (items: string[]) =>
    items
      .map((i) => {
        const found = (options as OptionObject[]).filter((f: OptionObject) => f.value === i)?.[0]
          ?.label
        return getTranslation(found, i18n)
      })
      .join(', ')

  let content = ''
  if (optionsAreObjects(options)) {
    content = Array.isArray(cellData)
      ? findLabel(cellData) // hasMany
      : findLabel([cellData])
  } else {
    content = Array.isArray(cellData)
      ? cellData.join(', ') // hasMany
      : cellData
  }

  return (
    <span
      title={content}
      className={'truncate ellipsis'}
      style={{
        width: width,
        maxWidth: width,
      }}
    >
      <DefaultCell {...props}></DefaultCell>
    </span>
  )
}
export default TruncatedSelectCell
