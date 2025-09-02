'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { formatNumberWithLocale } from '@/utils/numberUtils'

interface FormattedNumberProps extends DefaultCellComponentProps {
  decimals?: number
}

const FormattedNumber: React.FC<FormattedNumberProps> = ({ cellData, decimals = 2 }) => {
  return <span>{formatNumberWithLocale(cellData, decimals)}</span>
}

export default FormattedNumber
