'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
// Utility to format numbers with thousands separators
const formatNumber = (value: any) =>
  typeof value === 'number' ? value.toLocaleString('en-US') : value

const FormattedNumber: React.FC<DefaultCellComponentProps> = ({ cellData }) => {

  return <span>{formatNumber(cellData)}</span>
}

export default FormattedNumber
