'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { IconLinkProps } from './IconLinkProps'
import { TableLink } from '@/admincomponents/cell/TableLink'

/**
 * Props for the IconLink Cell component
 * Extends IconLinkProps with DefaultCellComponentProps
 */
export type IconLinkCellProps = IconLinkProps & DefaultCellComponentProps

/**
 * Cell component for displaying content with an optional icon link in PayloadCMS tables
 * @param props - Combined props from DefaultCellComponentProps and IconLinkCellProps
 * @returns React component
 */
const IconLinkCell = (props: DefaultCellComponentProps & IconLinkCellProps) => {
  const { cellData, urlTemplate, visibilityConditions } = props

  const linkValue = urlTemplate.replace('${value}', cellData || '')

  // Check if all conditions in visibilityConditions are met
  // If no conditions are provided, default to visible
  let isVisible = !!cellData
  if (visibilityConditions && props.rowData) {
    isVisible =
      isVisible &&
      Object.entries(visibilityConditions).every(
        ([field, expectedValue]) => props.rowData?.[field] === expectedValue,
      )
  }
  return isVisible ? (
    <TableLink href={linkValue} external={true} variant={'default'}></TableLink>
  ) : null
}
export default IconLinkCell
