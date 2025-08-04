'use client'
import type { DefaultCellComponentProps, TextFieldClient } from 'payload'
import React from 'react'
import { DefaultCell } from '@payloadcms/ui'

export type TextCellProps = DefaultCellComponentProps<TextFieldClient>

export const TruncatedCell: React.FC<TextCellProps> = (props) => {
  const {
    cellData,
    field: { admin },
  } = props
  const width = admin?.custom?.cellWidth
    ? admin?.custom?.cellWidth
    : admin?.width
      ? admin.width
      : 'auto'
  return (
    <span
      title={cellData}
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
export default TruncatedCell
