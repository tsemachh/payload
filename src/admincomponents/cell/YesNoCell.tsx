'use client'
import type { CheckboxFieldClient, DefaultCellComponentProps } from 'payload'

import React from 'react'

export const YesNoCell: React.FC<DefaultCellComponentProps<CheckboxFieldClient>> = ({
  cellData,
}) => {
  return (
    <span
      title={cellData ? 'כן' : 'לא'}
      className="inline-flex items-center justify-center w-[26px] h-[26px] text-base mx-auto px-6"
    >
      {cellData ? '✅' : '❌'}
    </span>
  )
}
export default YesNoCell
