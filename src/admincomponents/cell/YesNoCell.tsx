'use client'
import type { CheckboxFieldClient, DefaultCellComponentProps } from 'payload'

import React from 'react'

export const YesNoCell: React.FC<DefaultCellComponentProps<CheckboxFieldClient>> = ({
  cellData,
}) => {
  return (
    <code>
      <span>{cellData ? '✅' : '❌'}</span>
    </code>
  )
}
export default YesNoCell
