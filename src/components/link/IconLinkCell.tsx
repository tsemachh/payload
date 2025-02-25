'use client'
import React from 'react'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Props for the IconLink component
 * @interface IconLinkCellProps
 * @property {string} linkField - Field name to check in rowData for link
 * @property {string} iconUrl - URL of the icon to display
 * @property {string} iconAltText - Alt text for the icon
 */
export interface IconLinkCellProps {
  linkField: string
  iconUrl: string
  iconAltText: string
}

/**
 * Cell component for displaying content with an optional icon link in PayloadCMS tables
 * @param props - Combined props from DefaultCellComponentProps and IconLinkCellProps
 * @returns React component
 */
const IconLinkCell = (props: DefaultCellComponentProps & IconLinkCellProps) => {
  const { cellData, rowData } = props
  const linkValue = rowData?.[props.linkField]

  if (!cellData) return null

  if (linkValue) {
    return (
      <a
        href={linkValue}
        target="_blank"
        rel="noopener noreferrer"
        className="icon-link"
        title={linkValue}
        onClick={(e) => {
          // Prevent PayloadCMS form navigation warning
          e.stopPropagation()
        }}
      >
        <span>{cellData}</span>
        <img
          src={props.iconUrl}
          alt={props.iconAltText}
        />
      </a>
    )
  }

  return <span>{cellData}</span>
}

export default IconLinkCell