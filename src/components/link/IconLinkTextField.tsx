'use client'
import React from 'react'
import { TextField, useField } from '@payloadcms/ui'
import { TextFieldClientProps } from 'payload'
import { IconLinkProps } from './IconLinkProps'

/**
 * Props for the IconLink Field component
 * Extends IconLinkProps with TextFieldClientProps
 */
export type IconLinkFieldProps = IconLinkProps & TextFieldClientProps

/**
 * Field component for displaying text with an optional icon link in PayloadCMS forms
 * @param props - Props combining IconLinkProps and TextFieldClientProps
 * @returns React component
 */
const IconLinkTextField: React.FC<IconLinkFieldProps> = (props) => {
  const { path, urlTemplate, iconUrl, iconAltText, visibilityConditions, ...remainingProps } = props

  const { value } = useField<string>({
    path: path,
  })

  // Get values for all fields in visibilityConditions if provided
  const conditionValues: Record<string, any> = {}
  if (visibilityConditions) {
    Object.keys(visibilityConditions).forEach(fieldName => {
      const { value: fieldValue } = useField<any>({
        path: fieldName,
      })
      conditionValues[fieldName] = fieldValue
    })
  }

  const linkValue = value ? urlTemplate.replace('${value}', value) : null

  // Check if all conditions in visibilityConditions are met
  // If no conditions are provided, default to visible
  let isVisible = true
  if (visibilityConditions) {
    isVisible = Object.entries(visibilityConditions).every(([field, expectedValue]) => 
      conditionValues[field] === expectedValue
    )
  }

  return (
    <div className="inline-flex items-center">
      <span className="flex-grow mr-2 relative">
        <TextField {...remainingProps} path={path} />
        {linkValue && isVisible && (
          <a
            href={linkValue}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-md px-2 py-1 cursor-pointer ml-2  absolute top-[25px] left-[-5px]"
            title={linkValue}
            onClick={(e) => {
              // Prevent PayloadCMS form navigation warning
              e.stopPropagation()
            }}
          >
            <img src={iconUrl} alt={iconAltText} className="" />
          </a>
        )}
      </span>

    </div>
  )
}

export default IconLinkTextField
