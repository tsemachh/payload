'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { DefaultCell } from '@payloadcms/ui'
import { IconLinkProps } from './IconLinkProps'

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
  const { cellData, urlTemplate, iconUrl, iconAltText, visibilityConditions } = props

  const linkValue = urlTemplate.replace('${value}', cellData || '')

  // Check if all conditions in visibilityConditions are met
  // If no conditions are provided, default to visible
  let isVisible = cellData ? true : false
  if (visibilityConditions && props.rowData) {
    isVisible = isVisible && Object.entries(visibilityConditions).every(([field, expectedValue]) => 
      props.rowData?.[field] === expectedValue
    )
  }
  return (
    <span className="inline-flex items-center">
      <DefaultCell {...props} />
      {isVisible && (
        <img
          src={iconUrl}
          alt={iconAltText}
          className="icon-link bg-white rounded-full w-[26px] h-[26px] mx-2 py-1 cursor-pointer"
          title={linkValue}
          onClick={(e) => {
            // Prevent PayloadCMS form navigation warning
            e.stopPropagation()
            // Navigate to URL in new window
            window.open(linkValue, '_blank')
          }}
          role="link"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              window.open(linkValue, '_blank')
            }
          }}
        />
      )}
    </span>
  )
}
export default IconLinkCell
