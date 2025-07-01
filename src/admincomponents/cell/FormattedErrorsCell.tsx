'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'

const FormattedErrorsCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const errorCount = cellData?.errors?.length || 0

  return <span>{errorCount}</span>
}

export default FormattedErrorsCell
