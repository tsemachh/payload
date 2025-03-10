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
  const { cellData, urlTemplate, iconUrl, iconAltText, visibilityField } = props

  if (!cellData) return null

  const linkValue = urlTemplate.replace('${value}', cellData)

  // Check if the visibility field exists and its value is true in the row data
  const isVisible = visibilityField ? props.rowData?.[visibilityField] === true : true
  return (
    <span className="inline-flex items-center">
      <DefaultCell {...props} />
      {isVisible && (
        <img
          src={iconUrl}
          alt={iconAltText}
          className="icon-link bg-white rounded-md mx-2 py-1 cursor-pointer"
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
