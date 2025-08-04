'use client'
import type { DateFieldClient, DefaultCellComponentProps } from 'payload'

import React from 'react'

import { DefaultCell } from '@payloadcms/ui'

export const TruncatedDateCell: React.FC<DefaultCellComponentProps<DateFieldClient>> = (props) => {
  const {
    field: { admin: { date } = {} },
  } = props
  // @ts-ignore
  const pickerAppearance = date?.pickerAppearance
  const width = pickerAppearance == 'dayAndTime' ? '115px' : '80px'

  return (
    <span
      style={{
        width: width,
        maxWidth: width,
      }}
    >
      <DefaultCell {...props}></DefaultCell>
    </span>
  )
}

export default TruncatedDateCell
