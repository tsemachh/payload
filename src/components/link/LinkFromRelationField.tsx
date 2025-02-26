'use client'
import React from 'react'
import { useField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'

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
 * Field component for displaying a link with an icon in PayloadCMS forms
 * @param props - Combined props from TextFieldClientProps and LinkFromRelationFieldProps
 * @returns React component
 */
const LinkFromRelationField: React.FC<LinkFromRelationFieldProps & TextFieldClientProps> = (props) => {
  const { value } = useField<string>({
    path: props.path,
  })

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

export default LinkFromRelationField
