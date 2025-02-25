'use client'
import React from 'react'
import type { TextFieldClientProps ,DefaultCellComponentProps} from 'payload'

/**
 * Props for the LinkFromRelation components
 * @interface LinkFromRelationFieldProps
 * @property {string} iconUrl - URL of the icon to display
 * @property {string} iconAltText - Alt text for the icon
 */
export interface LinkFromRelationFieldProps {
  iconUrl: string
  iconAltText: string
}

/**
 * Cell component for displaying a link with an icon in PayloadCMS tables
 * @param props - Combined props from TextFieldClientProps and LinkFromRelationFieldProps
 * @returns React component
 */
const LinkFromRelationCell = (props: DefaultCellComponentProps & LinkFromRelationFieldProps ) => {
  const { cellData } = props
  const value = cellData
  if (!value) return null

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="link-from-relation"
      title={value}
      onClick={(e) => {
        // Prevent PayloadCMS form navigation warning
        e.stopPropagation()
      }}
    >
      <img
        src={props.iconUrl}
        alt={props.iconAltText}
      />
    </a>
  )
}

export default LinkFromRelationCell
